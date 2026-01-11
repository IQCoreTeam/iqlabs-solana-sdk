import {BorshCoder, EventParser, type Idl} from "@coral-xyz/anchor";
import {
    PublicKey,
    type MessageAccountKeys,
    type MessageCompiledInstruction,
    type VersionedTransactionResponse,
} from "@solana/web3.js";
import {getUserInventoryPda, getSessionPda, getUserPda, resolveContractRuntime} from "../../contract";
import {DEFAULT_CONTRACT_MODE} from "../../constants";
import {getConnection} from "../utils/connection_helper";
import {
    readerContext,
    resolveReaderModeFromTx,
    resolveReaderProgramId,
} from "./reader_context";
import {readInventoryMetadata} from "./reading_flow";

const {instructionCoder, idl} = readerContext;
const SIG_MIN_LEN = 80;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
const EVENT_CODER = new BorshCoder(idl as Idl);

export const decodeReaderInstruction = (
    ix: MessageCompiledInstruction,
    accountKeys: MessageAccountKeys,
): ReturnType<typeof instructionCoder.decode> | null => {
    const programId = accountKeys.get(ix.programIdIndex);
    if (!programId) {
        return null;
    }
    const isAnchor = programId.equals(readerContext.anchorProgramId);
    const isPinocchio = programId.equals(readerContext.pinocchioProgramId);
    if (!isAnchor && !isPinocchio) {
        return null;
    }
    return instructionCoder.decode(Buffer.from(ix.data));
};

// ----- user_inventory_code_in decoding -----
export const decodeUserInventoryCodeIn = (
    tx: VersionedTransactionResponse,
    mode: string = DEFAULT_CONTRACT_MODE,
): { onChainPath: string; metadata: string } => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();
    const userMode = resolveContractRuntime(mode);
    const resolvedMode = resolveReaderModeFromTx(tx) ?? userMode;

    for (const ix of message.compiledInstructions) {
        const decoded = decodeReaderInstruction(ix, accountKeys);
        if (!decoded) {
            continue;
        }
        if (
            decoded.name === "user_inventory_code_in" ||
            decoded.name === "user_inventory_code_in_for_free"
        ) {
            const data = decoded.data as { on_chain_path: string; metadata: string };
            return {onChainPath: data.on_chain_path, metadata: data.metadata};
        }
    }
    throw new Error("user_inventory_code_in instruction not found");
};

// ----- Table-trail event decoding -----
export const parseTableTrailEventsFromLogs = (
    logs: string[],
    mode: string = DEFAULT_CONTRACT_MODE,
) => {
    if (!logs || logs.length === 0) {
        return [];
    }
    const programId = resolveReaderProgramId(mode);
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
    mode: string = DEFAULT_CONTRACT_MODE,
) => parseTableTrailEventsFromLogs(tx?.meta?.logMessages ?? [], mode);

export async function readTableTrailEvents(
    txSignature: string,
    mode: string = DEFAULT_CONTRACT_MODE,
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
    mode: string = DEFAULT_CONTRACT_MODE,
): { inlineData?: string | null; targetSignature?: string } | null => {
    const tableEvents = parseTableTrailEventsFromLogs(logs, mode);
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

// ----- user_inventory_code_in metadata parsing -----
export const extractCodeInPayload = (
    tx: VersionedTransactionResponse,
    mode: string = DEFAULT_CONTRACT_MODE,
): { onChainPath: string; metadata: string; inlineData: string | null } => {
    const {onChainPath, metadata} = decodeUserInventoryCodeIn(tx, mode);
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

export async function getSessionPdaList(
    userPubkey: string,
    mode: string = DEFAULT_CONTRACT_MODE,
): Promise<string[]> {
    const connection = getConnection();
    const user = new PublicKey(userPubkey);
    const programId = resolveReaderProgramId(mode);
    const userState = getUserPda(user, programId);
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
        const session = getSessionPda(user, seq, programId);
        sessions.push(session.toBase58());
    }

    return sessions;
}
//high level but I put this because I think people should use this a lot
export const fetchInventoryTransactions = async (
    publicKey: PublicKey,
    limit: number,
    before?: string,
) => {
    const inventoryPda = getUserInventoryPda(publicKey);
    const signatures = await fetchAccountTransactions(inventoryPda, {
        limit,
        before,
    });
    const withMetadata = [];
    for (const sig of signatures) {
        try {
            const inventoryMetadata = await readInventoryMetadata(sig.signature);
            withMetadata.push({ ...sig, ...inventoryMetadata });
        } catch (err) {
            if (err instanceof Error && err.message === "user_inventory_code_in instruction not found") {
                continue;
            }
            throw err;
        }
    }
    return withMetadata;
};
