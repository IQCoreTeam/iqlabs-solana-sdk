import {PublicKey, type VersionedTransactionResponse} from "@solana/web3.js";

import {
    CONNECTION_STATUS_APPROVED,
    CONNECTION_STATUS_BLOCKED,
    CONNECTION_STATUS_PENDING,
    getConnectionTablePda,
    getDbRootPda,
    getUserPda,
} from "../../contract";
import {getConnection, getReaderConnection} from "../utils/connection_helper";
import {decodeConnectionMeta} from "../utils/global_fetch";
import {deriveDmSeed, toSeedBytes} from "../utils/seed";
import {resolveReadMode} from "./reader_profile";
import {readLinkedListResult, readSessionResult} from "./reading_methods";
import {readerContext} from "./reader_context";
import {ReplayServiceClient} from "./replayservice";
import {parseTableTrailEventsFromLogs} from "./table_trail";

const {instructionCoder, accountCoder, anchorProfile, pinocchioProfile} =
    readerContext;
const SIG_MIN_LEN = 80;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
const EMPTY_METADATA = "{}";
const replayService = new ReplayServiceClient();

const decodeDbCodeIn = (
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

const decodeEventValue = (value: Uint8Array) =>
    Buffer.from(value).toString("utf8").replace(/\0+$/, "");

const isSignature = (value: string) =>
    value.length >= SIG_MIN_LEN && BASE58_RE.test(value);

const parseTableTrailLogs = (logs: string[]) => {
    const anchorEvents = parseTableTrailEventsFromLogs(logs, "anchor");
    if (anchorEvents.length > 0) {
        return anchorEvents;
    }
    return parseTableTrailEventsFromLogs(logs, "pinocchio");
};

const resolveConnectionStatus = (status: number) => {
    if (status === CONNECTION_STATUS_PENDING) {
        return "pending";
    }
    if (status === CONNECTION_STATUS_APPROVED) {
        return "approved";
    }
    if (status === CONNECTION_STATUS_BLOCKED) {
        return "blocked";
    }
    return "unknown";
};
const readInscriptionInternal = async (
    txSignature: string,
    speed: string | undefined,
    visited: Set<string>,
): Promise<{ metadata: string; data: string | null }> => {
    if (visited.has(txSignature)) {
        throw new Error("table trail recursion detected");
    }
    visited.add(txSignature);

    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }

    const tableEvents = parseTableTrailLogs(tx.meta?.logMessages ?? []);
    if (tableEvents.length > 0) {
        const event = tableEvents[tableEvents.length - 1];
        const dataValue = decodeEventValue(event.data);
        const pathValue = decodeEventValue(event.path);
        let inlineData: string | null = null;
        let inlineTx: string | null = null;

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
                    if (Object.prototype.hasOwnProperty.call(parsed, "tx")) {
                        const txField = parsed.tx;
                        if (typeof txField === "string") {
                            inlineTx = txField;
                        }
                    }
                }
            } catch {
                // ignore malformed inline payload
            }
        }
        const dataIsSig = isSignature(dataValue);
        const pathIsSig = isSignature(pathValue);
        const inlineTxIsSig = inlineTx ? isSignature(inlineTx) : false;

        if (inlineData !== null) {
            return {metadata: EMPTY_METADATA, data: inlineData};
        }
        if (dataValue && !dataIsSig && !inlineTx) {
            return {metadata: EMPTY_METADATA, data: dataValue};
        }

        const fallbackSig = inlineTxIsSig
            ? inlineTx!
            : pathIsSig
                ? pathValue
                : dataIsSig
                    ? dataValue
                    : "";
        if (!fallbackSig) {
            return {metadata: EMPTY_METADATA, data: dataValue || null};
        }
        return readInscriptionInternal(fallbackSig, speed, visited);
    }

    const {onChainPath, metadata} = decodeDbCodeIn(tx);
    if (onChainPath.length === 0) {
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
        return {metadata: cleanedMetadata, data};
    }

    const readOption = resolveReadMode(onChainPath, tx.blockTime);
    const kind = onChainPath.length >= SIG_MIN_LEN ? "linked_list" : "session";
    if (kind === "session") {
        const {result} = await readSession(onChainPath, readOption, speed);
        return {metadata, data: result};
    }
    const {result} = await readLinkedListFromTail(onChainPath, readOption);
    return {metadata, data: result};
};

export async function readInscription(
    txSignature: string,
    speed?: string,
): Promise<{ metadata: string; data: string | null }> {
    return readInscriptionInternal(txSignature, speed, new Set());
}

export async function readDBMetadata(txSignature: string): Promise<{
    onChainPath: string;
    metadata: string;
}> {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }
    return decodeDbCodeIn(tx);
}

export async function readSession(
    sessionPubkey: string,
    readOption: { isReplay: boolean; freshness?: "fresh" | "recent" | "archive" },
    speed?: string,
): Promise<{ result: string | null }> {
    if (readOption.isReplay || readOption.freshness === "archive") {
        await replayService.enqueueReplay({sessionPubkey});
        return {result: null};
    }
    const connection = getReaderConnection(readOption.freshness);
    const info = await connection.getAccountInfo(new PublicKey(sessionPubkey));
    if (!info) {
        throw new Error("session account not found");
    }
    return readSessionResult(sessionPubkey, readOption, speed);
}

export async function readLinkedListFromTail(
    tailTx: string,
    readOption: { isReplay: boolean; freshness?: "fresh" | "recent" | "archive" },
    //we actually dont use is replay and archive in linked list but just left this for re using the type.
): Promise<{ result: string }> {
    const connection = getReaderConnection(readOption.freshness);
    const tx = await connection.getTransaction(tailTx, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("tail transaction not found");
    }
    return readLinkedListResult(tailTx, readOption);
}

export async function readUserState(userPubkey: string): Promise<{
    owner: string;
    metadata: string | null;
    totalSessionFiles: bigint;
    profileData?: string;
}> {
    const connection = getConnection();
    const user = new PublicKey(userPubkey);
    const userState = getUserPda(anchorProfile, user);
    const info = await connection.getAccountInfo(userState);
    if (!info) {
        throw new Error("user_state not found");
    }
    const decoded = accountCoder.decode("UserState", info.data) as {
        owner: PublicKey;
        metadata: Uint8Array;
        total_session_files: { toString(): string };
    };
    const rawMetadata = Buffer.from(decoded.metadata).toString("utf8");
    const metadata = rawMetadata.replace(/\0+$/, "").trim() || null;
    const totalSessionFiles = BigInt(decoded.total_session_files.toString());
    if (metadata) {
        const {data} = await readInscription(metadata);
        const profileData = data ?? undefined;
        return {
            owner: decoded.owner.toBase58(),
            metadata,
            totalSessionFiles,
            profileData,
        };
    }
    return {
        owner: decoded.owner.toBase58(),
        metadata: null,
        totalSessionFiles,
    };
}

export async function readConnection(
    dbRootId: Uint8Array | string,
    partyA: string,
    partyB: string,
): Promise<{ status: string }> {
    const connection = getConnection();
    const dbRootSeed = toSeedBytes(dbRootId);
    const dbRoot = getDbRootPda(anchorProfile, dbRootSeed);
    const connectionSeed = deriveDmSeed(partyA, partyB);
    const connectionTable = getConnectionTablePda(
        anchorProfile,
        dbRoot,
        connectionSeed,
    );
    const info = await connection.getAccountInfo(connectionTable);
    if (!info) {
        throw new Error("connection table not found");
    }
    const meta = decodeConnectionMeta(info.data);
    return {status: resolveConnectionStatus(meta.status)};
}
