import {PublicKey, VersionedTransactionResponse} from "@solana/web3.js";

import {
    getUserInventoryPda,
    getUserPda,
} from "../../contract";
import {getConnection, getReaderConnection} from "../utils/connection_helper";
import {resolveReadMode} from "./reader_profile";
import {readLinkedListResult, readSessionResult} from "./reading_methods";

import {readerContext} from "./reader_context";

import {
    decodeUserInventoryCodeIn,
    extractCodeInPayload,
    fetchAccountTransactions,
} from "./reader_utils";

const {accountCoder} = readerContext;
const SIG_MIN_LEN = 80;

export async function readInventoryMetadata(
    txSignature: string,
): Promise<{
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
    return decodeUserInventoryCodeIn(tx);
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

export async function readSession(
    sessionPubkey: string,
    readOption: { freshness?: "fresh" | "recent" | "archive" },
    speed?: string,
    onProgress?: (percent: number) => void,
): Promise<{ result: string | null }> {
    const connection = getReaderConnection(readOption.freshness);
    const info = await connection.getAccountInfo(new PublicKey(sessionPubkey));
    if (!info) {
        throw new Error("session account not found");
    }
    return readSessionResult(sessionPubkey, readOption, speed, onProgress);
}

export async function readLinkedListFromTail(
    tailTx: string,
    readOption: { freshness?: "fresh" | "recent" | "archive" },
    onProgress?: (percent: number) => void,
    expectedTotalChunks?: number,
): Promise<{ result: string }> {
    const connection = getReaderConnection(readOption.freshness);
    const tx = await connection.getTransaction(tailTx, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("tail transaction not found");
    }
    return readLinkedListResult(
        tailTx,
        readOption,
        onProgress,
        expectedTotalChunks,
    );
}

export async function readUserInventoryCodeInFromTx(
    tx: VersionedTransactionResponse,
    speed?: string,
    onProgress?: (percent: number) => void,
): Promise<{ metadata: string; data: string | null }> {
    const blockTime = tx.blockTime;
    const {onChainPath, metadata, inlineData} = extractCodeInPayload(tx);
    let totalChunks: number | undefined;
    try {
        const parsed = JSON.parse(metadata) as { total_chunks?: unknown };
        const rawTotal = parsed.total_chunks;
        if (typeof rawTotal === "number" && Number.isFinite(rawTotal)) {
            totalChunks = rawTotal;
        } else if (typeof rawTotal === "string") {
            const parsedTotal = Number.parseInt(rawTotal, 10);
            if (!Number.isNaN(parsedTotal)) {
                totalChunks = parsedTotal;
            }
        }
    } catch {
        // ignore malformed metadata
    }
    if (onChainPath.length === 0) {
        if (onProgress) {
            onProgress(100);
        }
        return {metadata, data: inlineData};
    }

    const readOption = resolveReadMode(onChainPath, blockTime);
    const kind = onChainPath.length >= SIG_MIN_LEN ? "linked_list" : "session";
    if (kind === "session") {
        const {result} = await readSession(
            onChainPath,
            readOption,
            speed,
            onProgress,
        );
        return {metadata, data: result};
    }
    const {result} = await readLinkedListFromTail(
        onChainPath,
        readOption,
        onProgress,
        totalChunks,
    );
    return {metadata, data: result};
}

export async function readUserState(
    userPubkey: string,
): Promise<{
    owner: string;
    metadata: string | null;
    totalSessionFiles: bigint;
    profileData?: string;
}> {
    const connection = getConnection();
    const user = new PublicKey(userPubkey);
    const programId = readerContext.anchorProgramId;
    const userState = getUserPda(user, programId);
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
