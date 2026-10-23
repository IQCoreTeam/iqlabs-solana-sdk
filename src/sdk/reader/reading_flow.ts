import {PublicKey, VersionedTransactionResponse} from "@solana/web3.js";

import {
    getUserInventoryPda,
    getUserPda,
} from "../../contract";
import {getConnection} from "../utils/connection_helper";
import {resolveReadMode} from "./reader_profile";
import {readLinkedListResult, readSessionResult} from "./reading_methods";

import {readerContext} from "./reader_context";
import {ReadBudget, type ReadLimits} from "./read_limits";

import {
    decodeUserInventoryCodeIn,
    extractCodeInPayload,
    fetchAccountTransactions,
} from "./reader_utils";

import {SIG_MIN_LEN} from "../constants";
import {type SessionSpeedOption} from "../utils/session_speed";

const {accountCoder} = readerContext;

export async function readInventoryMetadata(
    txSignature: string,
): Promise<{
    onChainPath: string;
    metadata: string;
}> {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 1,
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

export {readSessionResult as readSession} from "./reading_methods";

export async function readUserInventoryCodeInFromTx(
    tx: VersionedTransactionResponse,
    speed?: SessionSpeedOption,
    onProgress?: (percent: number) => void,
    limits?: ReadLimits,
): Promise<{ metadata: string; data: string | null }> {
    const budget = new ReadBudget(limits);
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
    if (totalChunks !== undefined) budget.checkChunkCount(totalChunks);
    if (onChainPath.length === 0) {
        if (inlineData !== null) budget.addChunk(inlineData);
        if (onProgress) {
            onProgress(100);
        }
        return {metadata, data: inlineData};
    }

    const readOption = resolveReadMode(onChainPath, blockTime);
    const kind = onChainPath.length >= SIG_MIN_LEN ? "linked_list" : "session";
    if (kind === "session") {
        // Reconstruct only from chunks posted by this code-in's own writer
        // (fee payer of this tx), ignoring any chunks a third party injected.
        const writer = (tx.transaction.message as unknown as {
            staticAccountKeys?: Array<{ toBase58(): string }>;
        }).staticAccountKeys?.[0]?.toBase58();
        const {result} = await readSessionResult(
            onChainPath,
            readOption,
            speed,
            onProgress,
            writer,
            budget,
        );
        return {metadata, data: result};
    }
    const {result} = await readLinkedListResult(
        onChainPath,
        readOption,
        onProgress,
        totalChunks,
        budget,
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
