import {BN, utils} from "@coral-xyz/anchor";
import {
    Connection,
    SystemProgram,
    Transaction,
    type PublicKey,
    type Signer,
    type VersionedTransactionResponse,
} from "@solana/web3.js";
import {decodeReaderInstruction} from "../reader/reader_utils";
import {
    createSessionInstruction,
    getSessionPda,
    postChunkInstruction,
    sendCodeInstruction,
    type InstructionBuilder,
} from "../../contract";
import {runWithConcurrency} from "../utils/concurrency";
import {rotateRpcConnection} from "../utils/connection_helper";
import {createRateLimiter} from "../utils/rate_limiter";
import {resolveSessionConfig, type SessionSpeedConfig, type SessionSpeedOption} from "../utils/session_speed";
import {shouldSendV1} from "../utils/tx_profile";
import type {SignerInput} from "../utils/wallet";
import {buildV1Transaction} from "./v1_tx";
import {sendTx, sendTxWithRetries} from "./writer_utils";

const resolveUploadConfig = (options?: { speed?: SessionSpeedOption }) => resolveSessionConfig(options?.speed);
//------------------------------------------------------------------------------------------------------------
export async function uploadLinkedList(
    connection: Connection,
    signer: SignerInput,
    builder: InstructionBuilder,
    user: PublicKey,
    codeAccount: PublicKey,
    chunks: string[],
    method: number,
    onProgress?: (percent: number) => void,
    options?: {speed?: SessionSpeedOption},
) {
    const totalChunks = chunks.length;
    let lastPercent = -1;
    if (onProgress) {
        onProgress(0);
        lastPercent = 0;
    }
    const config = resolveUploadConfig(options);
    const limiter = createRateLimiter(config.maxRps);
    let beforeTx = "Genesis";
    for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        if (limiter) {
            await limiter.wait();
        }
        const ix = sendCodeInstruction(
            builder,
            {
                user,
                code_account: codeAccount,
                system_program: SystemProgram.programId,
            },
            {
                code: chunk,
                before_tx: beforeTx,
                method,
                decode_break: 0,
            },
        );
        beforeTx = await sendTx(connection, signer, ix);
        if (onProgress && totalChunks > 0) {
            const percent = Math.floor(((index + 1) / totalChunks) * 100);
            if (percent !== lastPercent) {
                lastPercent = percent;
                onProgress(percent);
            }
        }
    }
    return beforeTx;
}

export async function uploadSession(
    connection: Connection,
    signer: SignerInput,
    builder: InstructionBuilder,
    programId: PublicKey,
    user: PublicKey,
    userState: PublicKey,
    seq: bigint,
    chunks: string[],
    method: number,
    options?: {speed?: SessionSpeedOption; onProgress?: (percent: number) => void},
) {
    const config = resolveUploadConfig(options);
    const totalChunks = chunks.length;
    let completed = 0;
    let lastPercent = -1;
    const onProgress = options?.onProgress;
    const reportProgress = (completedCount: number) => {
        completed = completedCount;
        if (!onProgress || totalChunks === 0) {
            return;
        }
        const percent = Math.floor((completed / totalChunks) * 100);
        if (percent !== lastPercent) {
            lastPercent = percent;
            onProgress(percent);
        }
    };
    reportProgress(0);
    const session = getSessionPda(user, seq, programId);
    const sessionInfo = await connection.getAccountInfo(session);
    if (!sessionInfo) {
        const createIx = createSessionInstruction(
            builder,
            {
                user,
                user_state: userState,
                session,
                system_program: SystemProgram.programId,
            },
            {seq: new BN(seq.toString())},
        );

        const firstIx = postChunkInstruction(
            builder,
            { user, session },
            {
                index: 0,
                chunk: chunks[0],
                method,
                decode_break: 0,
            }
        );

        // Session create must survive a genuine blockhash expiry on congested
        // RPCs; confirmLanded inside sendTx already absorbs false expiries.
        await sendTxWithRetries(connection, signer, [createIx, firstIx], false, 2, 1500);
        completed = 1;
    }

    // Resume: seq only advances on finalize, so a retry of an interrupted
    // upload re-derives the SAME session, whose landed chunks live in its tx
    // history. Skip a chunk only when the landed content matches exactly, so a
    // different payload reusing the seq re-sends and overwrites its index
    // instead of mixing with the stale session.
    let landedMap = new Map<number, string>();
    if (sessionInfo) {
        landedMap = await collectLandedChunks(connection, session, config);
    }
    const payloads = chunks
        .map((chunk, index) => ({chunk, index}))
        .filter((p) => (sessionInfo ? landedMap.get(p.index) !== p.chunk : p.index > 0));
    completed = totalChunks - payloads.length;
    reportProgress(completed);
    const baseCompleted = completed;

    if (signer instanceof Object && "secretKey" in signer) {
        await uploadSessionBatch(
            connection,
            signer as Signer,
            builder,
            user,
            session,
            payloads,
            method,
            config,
            (landedCount) => reportProgress(baseCompleted + landedCount),
        );
        return session.toBase58();
    }

    const limiter = createRateLimiter(config.maxRps);
    await runWithConcurrency(payloads, config.maxConcurrencyUpload, async (payload) => {
        if (limiter) {
            await limiter.wait();
        }
        const ix = postChunkInstruction(
            builder,
            {user, session},
            {
                index: payload.index,
                chunk: payload.chunk,
                method,
                decode_break: 0,
            },
        );
        await sendTxWithRetries(connection, signer, ix, true);
        reportProgress(completed + 1);
    });

    return session.toBase58();
}

/**
 * Keypair fast path for session chunks. A blockhash only lives ~60-90s, so
 * signing every chunk on one shared blockhash breaks when the send rate can't
 * push them all out before it expires — late chunks are born already expired.
 * Instead this signs and sends in windows sized to what maxRps can deliver
 * inside one blockhash's life: each window signs on a fresh blockhash, blasts
 * with skipPreflight, and rebroadcasts stragglers until they land or the
 * blockhash expires; unlanded chunks roll into the next window on a new
 * blockhash. Landing is tracked per chunk index via getSignatureStatuses
 * (searchTransactionHistory so a chunk confirmed early in a slow window isn't
 * missed once it ages out of the recent-status cache). Throws when chunks
 * still have not landed, so callers never finalize an incomplete session.
 */
async function uploadSessionBatch(
    connection: Connection,
    signer: Signer,
    builder: InstructionBuilder,
    user: PublicKey,
    session: PublicKey,
    payloads: Array<{chunk: string; index: number}>,
    method: number,
    config: SessionSpeedConfig,
    onLanded: (landedCount: number) => void,
) {
    const useV1 = await shouldSendV1(connection, signer);
    // reassigned by rotateRpcConnection when a configured failover pool exists
    let activeConnection = connection;
    const pending: Array<{chunk: string; index: number; raw: Buffer; signature: string}> =
        payloads.map((payload) => ({
            ...payload,
            raw: Buffer.alloc(0),
            signature: "",
        }));

    const signOnFreshBlockhash = async (items: typeof pending) => {
        const {blockhash, lastValidBlockHeight} = await activeConnection.getLatestBlockhash();
        for (const item of items) {
            const ix = postChunkInstruction(
                builder,
                {user, session},
                {
                    index: item.index,
                    chunk: item.chunk,
                    method,
                    decode_break: 0,
                },
            );
            if (useV1) {
                const {raw, signature} = buildV1Transaction(signer, [ix], blockhash);
                item.raw = raw;
                item.signature = signature;
            } else {
                const tx = new Transaction({recentBlockhash: blockhash, feePayer: signer.publicKey}).add(ix);
                tx.sign(signer);
                item.raw = tx.serialize();
                item.signature = utils.bytes.bs58.encode(tx.signature as Buffer);
            }
        }
        return lastValidBlockHeight;
    };

    const limiter = createRateLimiter(config.maxRps);
    let lastSendError: unknown;
    const blast = (items: typeof pending) =>
        runWithConcurrency(items, config.maxConcurrencyUpload, async (item) => {
            if (limiter) {
                await limiter.wait();
            }
            try {
                await activeConnection.sendRawTransaction(item.raw, {skipPreflight: true});
            } catch (error) {
                // rebroadcast next poll; surfaced by the completeness check if it never lands
                lastSendError = error;
                if (/429|Too Many Requests/i.test(String(error))) {
                    limiter?.throttle();
                }
                activeConnection = rotateRpcConnection(activeConnection.rpcEndpoint) ?? activeConnection;
            }
        });

    const landed = new Set<number>();
    const markLanded = async (items: typeof pending) => {
        // getSignatureStatuses caps at 256 signatures per call
        for (let i = 0; i < items.length; i += 256) {
            const batch = items.slice(i, i + 256);
            const {value} = await activeConnection.getSignatureStatuses(
                batch.map((item) => item.signature),
                {searchTransactionHistory: true},
            );
            value.forEach((status, j) => {
                if (status && !status.err) {
                    landed.add(batch[j].index);
                }
            });
        }
    };

    // Cap chunks per blockhash to what maxRps can push out before the ~60s
    // window closes, so no chunk is signed onto a blockhash that dies mid-send.
    const windowSize = Math.max(1, Math.floor(config.maxRps * 30));
    // Room for each window plus retry passes over stragglers rolled forward.
    const maxWindows = Math.ceil(pending.length / windowSize) * 3 + 5;

    let dryStreak = 0;
    for (let w = 0; w < maxWindows && landed.size < pending.length; w++) {
        const batch = pending.filter((item) => !landed.has(item.index)).slice(0, windowSize);
        const lastValidBlockHeight = await signOnFreshBlockhash(batch);
        await blast(batch);

        const landedBefore = landed.size;
        for (;;) {
            await new Promise((resolve) => setTimeout(resolve, 800));
            const missing = batch.filter((item) => !landed.has(item.index));
            await markLanded(missing);
            onLanded(landed.size);
            const stillMissing = batch.filter((item) => !landed.has(item.index));
            if (stillMissing.length === 0) {
                break;
            }
            // blockhash expired: roll the rest into the next window on a new one
            if ((await activeConnection.getBlockHeight()) > lastValidBlockHeight) {
                break;
            }
            await blast(stillMissing);
        }

        dryStreak = landed.size > landedBefore ? 0 : dryStreak + 1;
        if (dryStreak >= 3) {
            break;
        }
    }

    if (landed.size < pending.length) {
        const cause = lastSendError instanceof Error ? ` (last send error: ${lastSendError.message})` : "";
        throw new Error(
            `session upload incomplete: ${pending.length - landed.size}/${pending.length} chunks did not land${cause}`,
        );
    }
}
const extractPostChunks = (tx: VersionedTransactionResponse) => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();
    const out: Array<{index: number; chunk: string}> = [];
    for (const ix of message.compiledInstructions) {
        const decoded = decodeReaderInstruction(ix, accountKeys);
        if (decoded && decoded.name === "post_chunk") {
            const data = decoded.data as {index: number; chunk: string};
            out.push({index: data.index, chunk: data.chunk});
        }
    }
    return out;
};

/** Rebuild which chunk indexes already landed in an existing session by
 *  scanning its tx history (the same source the reader joins chunks from),
 *  paced by the active speed profile so a resume cannot rate-limit itself. */
async function collectLandedChunks(
    connection: Connection,
    session: PublicKey,
    config: SessionSpeedConfig,
): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const sigs: Array<{signature: string; err: unknown}> = [];
    let before: string | undefined;
    while (true) {
        const page = await connection.getSignaturesForAddress(session, {limit: 1000, before});
        if (page.length === 0) break;
        sigs.push(...page);
        if (page.length < 1000) break;
        before = page[page.length - 1]!.signature;
    }
    const limiter = createRateLimiter(config.maxRps);
    await runWithConcurrency(sigs.filter((s) => !s.err), config.maxConcurrency, async (s) => {
        if (limiter) {
            await limiter.wait();
        }
        const tx = await connection.getTransaction(s.signature, {maxSupportedTransactionVersion: 1});
        if (!tx || tx.meta?.err) {
            return;
        }
        for (const c of extractPostChunks(tx)) {
            map.set(c.index, c.chunk);
        }
    });
    return map;
}
