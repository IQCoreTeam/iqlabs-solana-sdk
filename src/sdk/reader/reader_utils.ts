import {BorshCoder, EventParser, type Idl} from "@coral-xyz/anchor";
import {PublicKey, type VersionedTransactionResponse} from "@solana/web3.js";
import {getSessionPda, getUserPda} from "../../contract";
import {getConnection} from "../utils/connection_helper";
import {readerContext} from "./reader_context";

const {instructionCoder, anchorProfile, pinocchioProfile, idl} = readerContext;
const SIG_MIN_LEN = 80;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
const EVENT_CODER = new BorshCoder(idl as Idl);

// ----- db_code_in decoding -----
export const decodeDbCodeIn = (
    tx: VersionedTransactionResponse,
): { onChainPath: string; metadata: string } => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();

    for (const ix of message.compiledInstructions) {
        const programId = accountKeys.get(ix.programIdIndex);
        if (!programId) {
            continue;
        }
        const isAnchor = programId.equals(anchorProfile.programId);
        const isPinocchio =
            pinocchioProfile !== null &&
            programId.equals(pinocchioProfile.programId);
        if (!isAnchor && !isPinocchio) {
            continue;
        }
        const decoded = instructionCoder.decode(Buffer.from(ix.data));
        if (!decoded) {
            continue;
        }
        if (decoded.name === "db_code_in" || decoded.name === "db_code_in_for_free") {
            const data = decoded.data as { on_chain_path: string; metadata: string };
            return {onChainPath: data.on_chain_path, metadata: data.metadata};
        }
    }
    throw new Error("db_code_in instruction not found");
};

// ----- Table-trail event decoding -----
export const parseTableTrailEventsFromLogs = (
    logs: string[],
    mode: "anchor" | "pinocchio",
) => {
    if (!logs || logs.length === 0) {
        return [];
    }
    const programId =
        mode === "anchor"
            ? anchorProfile.programId
            : pinocchioProfile.programId;
    const parser = new EventParser(programId, EVENT_CODER);
    const events: Array<{
        table: PublicKey;
        signer: PublicKey;
        data: Uint8Array<any>;
        path: Uint8Array<any>;
    }> = [];

    for (const event of parser.parseLogs(logs)) {
        if (event.name !== "TableTrailEmitted") {
            continue;
        }
        const eventData = event.data as {
            table: PublicKey;
            signer: PublicKey;
            data: Uint8Array<any>;
            target?: Uint8Array<any>;
            path?: Uint8Array<any>;
        };
        events.push({
            table: eventData.table,
            signer: eventData.signer,
            data: eventData.data,
            path: eventData.path ?? eventData.target ?? new Uint8Array(),
        });
    }

    return events;
};

export const parseTableTrailEventsFromTx = (
    tx: VersionedTransactionResponse | null,
    mode: "anchor" | "pinocchio",
) => parseTableTrailEventsFromLogs(tx?.meta?.logMessages ?? [], mode);

export async function readTableTrailEvents(
    txSignature: string,
    mode: "anchor" | "pinocchio",
) {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }
    return parseTableTrailEventsFromLogs(tx.meta?.logMessages ?? [], mode);
}

// ----- Table-trail payload parsing -----
export const resolveTableTrailPayload = (
    logs: string[],
): { inlineData?: string | null; targetSignature?: string } | null => {
    const anchorEvents = parseTableTrailEventsFromLogs(logs, "anchor");
    const tableEvents =
        anchorEvents.length > 0
            ? anchorEvents
            : parseTableTrailEventsFromLogs(logs, "pinocchio");
    if (tableEvents.length === 0) {
        return null;
    }

    const event = tableEvents[tableEvents.length - 1];
    const dataValue = Buffer.from(event.data)
        .toString("utf8")
        .replace(/\0+$/, "");
    const pathValue = Buffer.from(event.path)
        .toString("utf8")
        .replace(/\0+$/, "");
    let inlineData: string | null = null;
    let inlineSourceTx: string | null = null;

    if (dataValue) {
        try {
            const parsed = JSON.parse(dataValue) as Record<string, unknown>;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                if (Object.prototype.hasOwnProperty.call(parsed, "data")) {
                    const dataField = parsed.data;
                    if (typeof dataField === "string") {
                        inlineData = dataField;
                    } else if (dataField !== undefined && dataField !== null) {
                        inlineData = JSON.stringify(dataField);
                    }
                }
                if (Object.prototype.hasOwnProperty.call(parsed, "source_tx")) {
                    const txField = parsed.source_tx;
                    if (typeof txField === "string") {
                        inlineSourceTx = txField;
                    }
                }
            }
        } catch {
            // ignore malformed inline payload
        }
    }

    const dataIsSig = dataValue.length >= SIG_MIN_LEN && BASE58_RE.test(dataValue);
    const pathIsSig = pathValue.length >= SIG_MIN_LEN && BASE58_RE.test(pathValue);
    const inlineTxIsSig = inlineSourceTx
        ? inlineSourceTx.length >= SIG_MIN_LEN && BASE58_RE.test(inlineSourceTx)
        : false;

    if (inlineData !== null) {
        return {inlineData};
    }
    if (dataValue && !dataIsSig && !inlineSourceTx) {
        return {inlineData: dataValue};
    }

    const fallbackSig = inlineTxIsSig
        ? inlineSourceTx!
        : pathIsSig
            ? pathValue
            : dataIsSig
                ? dataValue
                : "";
    if (!fallbackSig) {
        return {inlineData: dataValue || null};
    }
    return {targetSignature: fallbackSig};
};

// ----- db_code_in metadata parsing -----
export const extractCodeInPayload = (
    tx: VersionedTransactionResponse,
): { onChainPath: string; metadata: string; inlineData: string | null } => {
    const {onChainPath, metadata} = decodeDbCodeIn(tx);
    if (onChainPath.length > 0) {
        return {onChainPath, metadata, inlineData: null};
    }

    let data: string | null = null;
    let cleanedMetadata = metadata;
    try {
        const parsed = JSON.parse(metadata) as Record<string, unknown>;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            if (Object.prototype.hasOwnProperty.call(parsed, "data")) {
                const dataValue = parsed.data;
                delete parsed.data;
                cleanedMetadata = JSON.stringify(parsed);
                if (typeof dataValue === "string") {
                    data = dataValue;
                } else if (dataValue !== undefined && dataValue !== null) {
                    data = JSON.stringify(dataValue);
                }
            }
        }
    } catch {
        // ignore malformed metadata
    }
    return {onChainPath, metadata: cleanedMetadata, inlineData: data};
};

export async function fetchAccountTransactions( // this use for bringing the db pda list, session chunk list, friend list , we dont check data here bacause it increases rpc call
    account: string | PublicKey,
    options: { before?: string; limit?: number } = {},
) {
    const {before, limit} = options;
    if (typeof limit === "number" && limit <= 0) {
        return [];
    }

    const pubkey = typeof account === "string" ? new PublicKey(account) : account;
    return getConnection().getSignaturesForAddress(pubkey, {before, limit});
}

export async function getSessionPdaList(userPubkey: string): Promise<string[]> {
    const connection = getConnection();
    const user = new PublicKey(userPubkey);
    const userState = getUserPda(readerContext.anchorProfile, user);
    const info = await connection.getAccountInfo(userState);
    if (!info) {
        throw new Error("user_state not found");
    }
    const decoded = readerContext.accountCoder.decode("UserState", info.data) as {
        total_session_files: { toString(): string };
    };
    const totalSessionFiles = BigInt(decoded.total_session_files.toString());
    const sessions: string[] = [];

    for (let seq = BigInt(0); seq < totalSessionFiles; seq += BigInt(1)) {
        const session = getSessionPda(readerContext.anchorProfile, user, seq);
        sessions.push(session.toBase58());
    }

    return sessions;
}
