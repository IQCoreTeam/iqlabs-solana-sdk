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

import {getReaderConnection, getRpcUrl} from "../utils/connection_helper";
import {runWithConcurrency} from "../utils/concurrency";
import {createRateLimiter} from "../utils/rate_limiter";
import {SESSION_SPEED_PROFILES, resolveSessionSpeed} from "../utils/session_speed";
import {decodeReaderInstruction} from "./reader_utils";

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

const extractPostChunk = (tx: VersionedTransactionResponse) => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();
    const chunks: Array<{ index: number; chunk: string }> = [];

    for (const ix of message.compiledInstructions) {
        const decoded = decodeReaderInstruction(ix, accountKeys);
        if (decoded && decoded.name === "post_chunk") {
            const data = decoded.data as { index: number; chunk: string };
            chunks.push({index: data.index, chunk: data.chunk});
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

// bulk session read via helius getTransactionsForAddress — returns null if unavailable
async function readSessionViaGtfa(
    sessionPubkey: string,
    onProgress?: (percent: number) => void,
): Promise<{ result: string } | null> {
    const rpcUrl = getRpcUrl();
    if (!rpcUrl.includes("helius-rpc.com") && !rpcUrl.includes("helius.dev")) return null;
    if (onProgress) onProgress(0);

    const allTxs: VersionedTransactionResponse[] = [];
    let paginationToken: string | undefined;

    try {
        while (true) {
            const res = await fetch(rpcUrl, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "getTransactionsForAddress",
                    params: [sessionPubkey, {
                        limit: 100,
                        transactionDetails: "full",
                        ...(paginationToken ? {paginationToken} : {}),
                    }],
                }),
            });
            if (!res.ok) return null;
            const json = await res.json() as {
                result?: { data?: VersionedTransactionResponse[]; paginationToken?: string };
                error?: unknown;
            };
            if (json.error) return null;
            const data = json.result?.data ?? [];
            if (data.length === 0) break;
            allTxs.push(...data);
            paginationToken = json.result?.paginationToken;
            if (!paginationToken || data.length < 100) break;
        }
    } catch {
        return null;
    }

    if (allTxs.length === 0) return null;

    // decode post_chunk from raw json response
    const {instructionCoder} = (await import("./reader_context")).readerContext;
    // @ts-ignore — bs58 has no type declarations
    const bs58mod = await import("bs58");
    const decode58: (s: string) => Uint8Array = bs58mod.decode ?? bs58mod.default?.decode ?? bs58mod.default;
    const programId = (await import("../../contract")).DEFAULT_ANCHOR_PROGRAM_ID;

    const chunkMap = new Map<number, string>();
    for (let i = 0; i < allTxs.length; i++) {
        const tx = allTxs[i] as any;
        const msg = tx.transaction?.message;
        if (!msg) continue;
        const keys: string[] = msg.accountKeys ?? [];
        for (const ix of msg.instructions ?? []) {
            if (keys[ix.programIdIndex] !== programId) continue;
            try {
                const decoded = instructionCoder.decode(
                    Buffer.from(typeof decode58 === "function" ? decode58(ix.data) : ix.data),
                    "base58",
                );
                if (decoded?.name === "post_chunk") {
                    const d = decoded.data as { index: number; chunk: string };
                    chunkMap.set(d.index, d.chunk);
                }
            } catch {}
        }
        if (onProgress) onProgress(Math.floor(((i + 1) / allTxs.length) * 100));
    }

    if (chunkMap.size === 0) return null;
    if (onProgress) onProgress(100);
    return {
        result: Array.from(chunkMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([, chunk]) => chunk)
            .join(""),
    };
}

export async function readSessionResult(
    sessionPubkey: string,
    readOption: { freshness?: "fresh" | "recent" | "archive" },
    speed?: string,
    onProgress?: (percent: number) => void,
): Promise<{ result: string }> {
    // try bulk read first, fall back to sequential
    const bulk = await readSessionViaGtfa(sessionPubkey, onProgress);
    if (bulk) return bulk;

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
