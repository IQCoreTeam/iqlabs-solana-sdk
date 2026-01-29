// reading_methods.ts scope notes (comments only)
// - Shared low-level read helpers used by reading_flow.ts.
// - Keep logic here; reading_flow.ts just describes the path.
//
// ReadOption
// - freshness: "fresh" | "recent" | "archive"
//
// 1) readSessionResult(sessionPubkey, readOption, speed?)
//    Input:
//      - sessionPubkey: string (base58)
//      - readOption: ReadOption
//      - speed?: string
//    Output:
//      - { result }
//    Steps:
//      - fetch/validate session account (discriminator/owner/size)
//      - collect session chunk txs (listSessionChunks)
//      - decode post_chunk args: seq, index, chunk, method, decode_break
//      - sort by index, reconstruct result
//      - return result
//    Notes:
//      - method/decode_break rules follow transaction.provider.ts
//
// 2) readLinkedListResult(tailTx, readOption)
//    Input:
//      - tailTx: string (tx signature)
//      - readOption: { freshness?: "fresh" | "recent" }
//    Output:
//      - { result }
//    Steps:
//      - ensure tailTx is a send_code tail (validate here if needed)
//      - walk send_code chain: decode { code, before_tx }
//      - accumulate chunks until "Genesis"
//      - reverse and reconstruct result
//      - return result
//    Notes:
//      - RPC choice: <=24h -> zeroblock, else -> helius

import {PublicKey, type VersionedTransactionResponse} from "@solana/web3.js";

import {DEFAULT_CONTRACT_MODE} from "../../constants";
import {getReaderConnection} from "../utils/connection_helper";
import {runWithConcurrency} from "../utils/concurrency";
import {createRateLimiter} from "../utils/rate_limiter";
import {SESSION_SPEED_PROFILES, resolveSessionSpeed} from "../utils/session_speed";
import {decodeReaderInstruction} from "./reader_utils";
import {readerContext} from "./reader_context";

const resolveSessionConfig = (speed?: string) => {
    const resolvedSpeed = resolveSessionSpeed(speed);
    return SESSION_SPEED_PROFILES[resolvedSpeed];
};

const extractAnchorInstruction = (
    tx: VersionedTransactionResponse,
    expectedName: string,
) => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();

    for (const ix of message.compiledInstructions) {
        const decoded = decodeReaderInstruction(ix, accountKeys);
        if (!decoded) {
            continue;
        }
        if (decoded.name === expectedName) {
            return decoded.data as Record<string, unknown>;
        }
    }
    return null;
};

const extractPinocchioPostChunk = (data: Buffer) => {
    if (data.length < 22 || data[0] !== 0x04) {
        return null;
    }
    let offset = 1 + 16;
    const index = data.readUInt32LE(offset);
    offset += 4;
    const remaining = data.subarray(offset);
    if (remaining.length === 0) {
        return null;
    }
    if (remaining.length >= 5) {
        const stringLen = remaining.readUInt32LE(0);
        const payloadEnd = 4 + stringLen;
        if (payloadEnd < remaining.length) {
            const chunk = remaining.subarray(4, payloadEnd).toString("utf8");
            return {index, chunk};
        }
    }
    if (remaining.length <= 1) {
        return null;
    }
    const chunk = remaining.subarray(1).toString("utf8");
    return {index, chunk};
};

const extractPostChunk = (tx: VersionedTransactionResponse) => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();
    const chunks: Array<{ index: number; chunk: string }> = [];

    for (const ix of message.compiledInstructions) {
        const programId = accountKeys.get(ix.programIdIndex);
        const decoded = decodeReaderInstruction(ix, accountKeys);
        if (decoded && decoded.name === "post_chunk") {
            const data = decoded.data as { index: number; chunk: string };
            chunks.push({index: data.index, chunk: data.chunk});
            continue;
        }
        if (programId?.equals(readerContext.pinocchioProgramId)) {
            const parsed = extractPinocchioPostChunk(Buffer.from(ix.data));
            if (parsed) {
                chunks.push(parsed);
            }
        }
    }

    return chunks;
};

const extractSendCode = (tx: VersionedTransactionResponse) => {
    const data = extractAnchorInstruction(tx, "send_code") as
        | { code: string; before_tx: string }
        | null;
    if (!data) {
        return null;
    }
    return {code: data.code, beforeTx: data.before_tx};
};

export async function readSessionResult(
    sessionPubkey: string,
    readOption: { freshness?: "fresh" | "recent" | "archive" },
    speed?: string,
    mode: string = DEFAULT_CONTRACT_MODE,
    onProgress?: (percent: number) => void,
): Promise<{ result: string }> {
    const connection = getReaderConnection(readOption.freshness);
    const sessionKey = new PublicKey(sessionPubkey);
    const signatures = [];
    let before: string | undefined;
    //TODO make this pagination well if we need to pagination, or make this bringing all function to the helper function and reuse for needs
    while (true) {
        const page = await connection.getSignaturesForAddress(sessionKey, {
            limit: 1000,
            before,
        });
        if (page.length === 0) {
            break;
        }
        signatures.push(...page);
        if (page.length < 1000) {
            break;
        }
        const nextBefore = page[page.length - 1]?.signature;
        if (!nextBefore || nextBefore === before) {
            break;
        }
        before = nextBefore;
    }
    const chunkMap = new Map<number, string>();
    const sessionConfig = resolveSessionConfig(speed);
    const limiter = createRateLimiter(sessionConfig.maxRps);
    const maxConcurrency = sessionConfig.maxConcurrency;
    const totalSignatures = signatures.length;
    let completed = 0;
    let lastPercent = -1;
    if (onProgress) {
        onProgress(0);
        lastPercent = 0;
    }

    await runWithConcurrency(signatures, maxConcurrency, async (entry) => {
        if (limiter) {
            await limiter.wait();
        }
        const tx = await connection.getTransaction(entry.signature, {
            maxSupportedTransactionVersion: 0,
        });

        if (!tx) {
            return;
        }
        const chunks = extractPostChunk(tx);
        for (const chunk of chunks) {
            chunkMap.set(chunk.index, chunk.chunk);
        }
        completed += 1;
        if (onProgress && totalSignatures > 0) {
            const percent = Math.floor((completed / totalSignatures) * 100);
            if (percent !== lastPercent) {
                lastPercent = percent;
                onProgress(percent);
            }
        }
    });
    if (chunkMap.size === 0) {
        throw new Error("no session chunks found");
    }
    const result = Array.from(chunkMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([, chunk]) => chunk)
        .join("");
    if (onProgress && totalSignatures > 0 && lastPercent < 100) {
        onProgress(100);
    }

    return {result};
}

export async function readLinkedListResult(
    tailTx: string,
    readOption: { freshness?: "fresh" | "recent" | "archive" },
    mode: string = DEFAULT_CONTRACT_MODE,
    onProgress?: (percent: number) => void,
    expectedTotalChunks?: number,
): Promise<{ result: string }> {
    const connection = getReaderConnection(readOption.freshness);
    const chunks: string[] = [];
    const visited = new Set<string>();
    let cursor = tailTx;
    const totalChunks = expectedTotalChunks ?? 0;
    let processed = 0;
    let lastPercent = -1;
    if (onProgress) {
        onProgress(0);
        lastPercent = 0;
    }

    while (cursor && cursor !== "Genesis") {
        if (visited.has(cursor)) {
            throw new Error("linked list loop detected");
        }
        visited.add(cursor);

        const tx = await connection.getTransaction(cursor, {
            maxSupportedTransactionVersion: 0,
        });
        if (!tx) {
            throw new Error("linked list transaction not found");
        }

        const decoded = extractSendCode(tx);
        if (!decoded) {
            throw new Error("send_code instruction not found");
        }

        chunks.push(decoded.code);
        processed += 1;
        if (onProgress && totalChunks > 0) {
            const percent = Math.min(
                100,
                Math.floor((processed / totalChunks) * 100),
            );
            if (percent !== lastPercent) {
                lastPercent = percent;
                onProgress(percent);
            }
        }
        cursor = decoded.beforeTx;
    }
    if (onProgress && lastPercent < 100) {
        onProgress(100);
    }

    return {result: chunks.reverse().join("")};
}
