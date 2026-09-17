import {BN, utils} from "@coral-xyz/anchor";
import {Connection, SystemProgram, Transaction, type PublicKey, type Signer} from "@solana/web3.js";
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

        await sendTx(connection, signer, [createIx, firstIx]);
        completed = 1;
    }

    const payloads = chunks.slice(1).map((chunk, i) => ({ chunk, index: i + 1 }))
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
 * Keypair fast path for session chunks: sign every chunk tx up front on one
 * shared blockhash, blast them in parallel with skipPreflight, and track
 * landing per chunk index via getSignatureStatuses. Chunks that miss the
 * blockhash window can never land from a resend of the same bytes, so once
 * the window expires only the missing indexes are re-signed on a fresh
 * blockhash. Throws when chunks still have not landed after the round budget,
 * so callers never finalize an incomplete session.
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
    const pending: Array<{chunk: string; index: number; raw: Buffer; signature: string; sent: boolean}> =
        payloads.map((payload) => ({
            ...payload,
            raw: Buffer.alloc(0),
            signature: "",
            sent: false,
        }));

    const signAllOnFreshBlockhash = async (items: typeof pending) => {
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
            item.sent = false;
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
                item.sent = true;
            } catch (error) {
                // stays unsent; re-blasted next round and surfaced by the
                // completeness check if it never lands
                lastSendError = error;
                if (/429|Too Many Requests/i.test(String(error))) {
                    limiter?.throttle();
                }
                activeConnection = rotateRpcConnection(activeConnection.rpcEndpoint) ?? activeConnection;
            }
        });

    let lastValidBlockHeight = await signAllOnFreshBlockhash(pending);
    await blast(pending);

    const landed = new Set<number>();
    // A shared blockhash lives ~150 blocks (roughly 60-90s); 30 rounds of 2s
    // polling spans several re-sign windows before giving up.
    for (let round = 0; round < 30 && landed.size < pending.length; round++) {
        const unsent = pending.filter((item) => !item.sent);
        if (unsent.length > 0) {
            await blast(unsent);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const awaiting = pending.filter((item) => item.sent && !landed.has(item.index));
        // getSignatureStatuses caps at 256 signatures per call
        for (let i = 0; i < awaiting.length; i += 256) {
            const batch = awaiting.slice(i, i + 256);
            const {value} = await activeConnection.getSignatureStatuses(batch.map((item) => item.signature));
            value.forEach((status, j) => {
                if (status && !status.err) {
                    landed.add(batch[j].index);
                }
            });
        }
        onLanded(landed.size);
        if (landed.size === pending.length) {
            break;
        }
        if ((await activeConnection.getBlockHeight()) > lastValidBlockHeight) {
            const missing = pending.filter((item) => !landed.has(item.index));
            lastValidBlockHeight = await signAllOnFreshBlockhash(missing);
            await blast(missing);
        }
    }

    if (landed.size < pending.length) {
        const cause = lastSendError instanceof Error ? ` (last send error: ${lastSendError.message})` : "";
        throw new Error(
            `session upload incomplete: ${pending.length - landed.size}/${pending.length} chunks did not land${cause}`,
        );
    }
}