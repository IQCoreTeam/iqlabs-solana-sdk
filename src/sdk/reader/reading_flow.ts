import {PublicKey, VersionedTransactionResponse} from "@solana/web3.js";

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
import {decodeDbCodeIn, extractCodeInPayload} from "./reader_utils";

const {accountCoder, anchorProfile} = readerContext;
const SIG_MIN_LEN = 80;
const EMPTY_METADATA = "{}";
const replayService = new ReplayServiceClient();

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

export async function readDbCodeInFromTx(
    tx: VersionedTransactionResponse,
    speed?: string,
): Promise<{ metadata: string; data: string | null }> {
    const blockTime = tx.blockTime;

    const {onChainPath, metadata, inlineData} = extractCodeInPayload(tx);
    if (onChainPath.length === 0) {
        return {metadata, data: inlineData};
    }

    const readOption = resolveReadMode(onChainPath, blockTime);
    const kind = onChainPath.length >= SIG_MIN_LEN ? "linked_list" : "session";
    if (kind === "session") {
        const {result} = await readSession(onChainPath, readOption, speed);
        return {metadata, data: result};
    }
    const {result} = await readLinkedListFromTail(onChainPath, readOption);
    return {metadata, data: result};
}

export async function readDbRowContent(
    tablePayload: { inlineData?: string | null; targetSignature?: string },
    speed?: string,
): Promise<{ metadata: string; data: string | null }> {
    if (tablePayload.inlineData !== undefined) {
        return {
            metadata: EMPTY_METADATA,
            data: tablePayload.inlineData ?? null,
        };
    }

    const targetSignature = tablePayload.targetSignature;
    if (!targetSignature) {
        return {metadata: EMPTY_METADATA, data: null};
    }

    const connection = getConnection();
    const tx = await connection.getTransaction(targetSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }

    return await readDbCodeInFromTx(tx, speed);
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
        metadata: Uint8Array<any>;
        total_session_files: { toString(): string };
    };
    const rawMetadata = Buffer.from(decoded.metadata).toString("utf8");
    const metadata = rawMetadata.replace(/\0+$/, "").trim() || null;
    const totalSessionFiles = BigInt(decoded.total_session_files.toString());
    if (metadata) {
        const {readCodeIn} = await import("./read_code_in");
        const {data} = await readCodeIn(metadata);
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
    dbRootId: Uint8Array<any> | string,
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
