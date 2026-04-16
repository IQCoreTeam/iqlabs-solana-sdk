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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readSessionResult = readSessionResult;
exports.readLinkedListResult = readLinkedListResult;
const web3_js_1 = require("@solana/web3.js");
const connection_helper_1 = require("../utils/connection_helper");
const concurrency_1 = require("../utils/concurrency");
const rate_limiter_1 = require("../utils/rate_limiter");
const session_speed_1 = require("../utils/session_speed");
const reader_utils_1 = require("./reader_utils");
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
const extractPostChunk = (tx) => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();
    const chunks = [];
    for (const ix of message.compiledInstructions) {
        const decoded = (0, reader_utils_1.decodeReaderInstruction)(ix, accountKeys);
        if (decoded && decoded.name === "post_chunk") {
            const data = decoded.data;
            chunks.push({ index: data.index, chunk: data.chunk });
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
// bulk session read via helius getTransactionsForAddress — returns null if unavailable
async function readSessionViaGtfa(sessionPubkey, onProgress) {
    const rpcUrl = (0, connection_helper_1.getRpcUrl)();
    if (!rpcUrl.includes("helius-rpc.com") && !rpcUrl.includes("helius.dev"))
        return null;
    if (onProgress)
        onProgress(0);
    const allTxs = [];
    let paginationToken;
    try {
        while (true) {
            const res = await fetch(rpcUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "getTransactionsForAddress",
                    params: [sessionPubkey, {
                            limit: 100,
                            transactionDetails: "full",
                            ...(paginationToken ? { paginationToken } : {}),
                        }],
                }),
            });
            if (!res.ok)
                return null;
            const json = await res.json();
            if (json.error)
                return null;
            const data = json.result?.data ?? [];
            if (data.length === 0)
                break;
            allTxs.push(...data);
            paginationToken = json.result?.paginationToken;
            if (!paginationToken || data.length < 100)
                break;
        }
    }
    catch {
        return null;
    }
    if (allTxs.length === 0)
        return null;
    // decode post_chunk from raw json response
    const { instructionCoder } = (await Promise.resolve().then(() => __importStar(require("./reader_context")))).readerContext;
    // @ts-ignore — bs58 v6 exports default only
    const bs58mod = await Promise.resolve().then(() => __importStar(require("bs58")));
    // @ts-ignore
    const decode58 = bs58mod.decode ?? bs58mod.default?.decode ?? bs58mod.default;
    const programId = (await Promise.resolve().then(() => __importStar(require("../../contract")))).DEFAULT_ANCHOR_PROGRAM_ID;
    const chunkMap = new Map();
    for (let i = 0; i < allTxs.length; i++) {
        const tx = allTxs[i];
        const msg = tx.transaction?.message;
        if (!msg)
            continue;
        const keys = msg.accountKeys ?? [];
        for (const ix of msg.instructions ?? []) {
            if (keys[ix.programIdIndex] !== programId)
                continue;
            try {
                const decoded = instructionCoder.decode(Buffer.from(typeof decode58 === "function" ? decode58(ix.data) : ix.data), "base58");
                if (decoded?.name === "post_chunk") {
                    const d = decoded.data;
                    chunkMap.set(d.index, d.chunk);
                }
            }
            catch { }
        }
        if (onProgress)
            onProgress(Math.floor(((i + 1) / allTxs.length) * 100));
    }
    if (chunkMap.size === 0)
        return null;
    if (onProgress)
        onProgress(100);
    return {
        result: Array.from(chunkMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([, chunk]) => chunk)
            .join(""),
    };
}
async function readSessionResult(sessionPubkey, readOption, speed, onProgress) {
    // try bulk read first, fall back to sequential
    const bulk = await readSessionViaGtfa(sessionPubkey, onProgress);
    if (bulk)
        return bulk;
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
async function readLinkedListResult(tailTx, readOption, onProgress, expectedTotalChunks) {
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
