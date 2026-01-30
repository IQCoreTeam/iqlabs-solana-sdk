"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.readSessionResult = readSessionResult;
exports.readLinkedListResult = readLinkedListResult;
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("../../constants");
const connection_helper_1 = require("../utils/connection_helper");
const concurrency_1 = require("../utils/concurrency");
const rate_limiter_1 = require("../utils/rate_limiter");
const session_speed_1 = require("../utils/session_speed");
const reader_utils_1 = require("./reader_utils");
const reader_context_1 = require("./reader_context");
const resolveSessionConfig = (speed) => {
    const resolvedSpeed = (0, session_speed_1.resolveSessionSpeed)(speed);
    return session_speed_1.SESSION_SPEED_PROFILES[resolvedSpeed];
};
const extractAnchorInstruction = (tx, expectedName) => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();
    for (const ix of message.compiledInstructions) {
        const decoded = (0, reader_utils_1.decodeReaderInstruction)(ix, accountKeys);
        if (!decoded) {
            continue;
        }
        if (decoded.name === expectedName) {
            return decoded.data;
        }
    }
    return null;
};
const extractPinocchioPostChunk = (data) => {
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
            return { index, chunk };
        }
    }
    if (remaining.length <= 1) {
        return null;
    }
    const chunk = remaining.subarray(1).toString("utf8");
    return { index, chunk };
};
const extractPostChunk = (tx) => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();
    const chunks = [];
    for (const ix of message.compiledInstructions) {
        const programId = accountKeys.get(ix.programIdIndex);
        const decoded = (0, reader_utils_1.decodeReaderInstruction)(ix, accountKeys);
        if (decoded && decoded.name === "post_chunk") {
            const data = decoded.data;
            chunks.push({ index: data.index, chunk: data.chunk });
            continue;
        }
        if (programId?.equals(reader_context_1.readerContext.pinocchioProgramId)) {
            const parsed = extractPinocchioPostChunk(Buffer.from(ix.data));
            if (parsed) {
                chunks.push(parsed);
            }
        }
    }
    return chunks;
};
const extractSendCode = (tx) => {
    const data = extractAnchorInstruction(tx, "send_code");
    if (!data) {
        return null;
    }
    return { code: data.code, beforeTx: data.before_tx };
};
async function readSessionResult(sessionPubkey, readOption, speed, mode = constants_1.DEFAULT_CONTRACT_MODE, onProgress) {
    const connection = (0, connection_helper_1.getReaderConnection)(readOption.freshness);
    const sessionKey = new web3_js_1.PublicKey(sessionPubkey);
    const signatures = [];
    let before;
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
    const chunkMap = new Map();
    const sessionConfig = resolveSessionConfig(speed);
    const limiter = (0, rate_limiter_1.createRateLimiter)(sessionConfig.maxRps);
    const maxConcurrency = sessionConfig.maxConcurrency;
    const totalSignatures = signatures.length;
    let completed = 0;
    let lastPercent = -1;
    if (onProgress) {
        onProgress(0);
        lastPercent = 0;
    }
    await (0, concurrency_1.runWithConcurrency)(signatures, maxConcurrency, async (entry) => {
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
    return { result };
}
async function readLinkedListResult(tailTx, readOption, mode = constants_1.DEFAULT_CONTRACT_MODE, onProgress, expectedTotalChunks) {
    const connection = (0, connection_helper_1.getReaderConnection)(readOption.freshness);
    const chunks = [];
    const visited = new Set();
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
            const percent = Math.min(100, Math.floor((processed / totalChunks) * 100));
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
    return { result: chunks.reverse().join("") };
}
