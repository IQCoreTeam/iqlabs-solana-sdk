import {BN} from "@coral-xyz/anchor";
import {Connection, SystemProgram, type PublicKey} from "@solana/web3.js";
import {
    createSessionInstruction,
    getSessionPda,
    postChunkInstruction,
    sendCodeInstruction,
    type InstructionBuilder,
} from "../../contract";
import {runWithConcurrency} from "../utils/concurrency";
import {createRateLimiter} from "../utils/rate_limiter";
import {SESSION_SPEED_PROFILES, resolveSessionSpeed} from "../utils/session_speed";
import type {SignerInput} from "../utils/wallet";
import {sendTx} from "./writer_utils";

const resolveUploadConfig = (options?: { speed?: string }) => {
    const resolvedSpeed = resolveSessionSpeed(options?.speed);
    const profile = SESSION_SPEED_PROFILES[resolvedSpeed];
    return {
        maxConcurrency: profile.maxConcurrency,
        maxRps: profile.maxRps,
    };
};
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
    options?: {speed?: string},
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
    options?: {speed?: string; onProgress?: (percent: number) => void},
) {
    const config = resolveUploadConfig(options);
    const totalChunks = chunks.length;
    let completed = 0;
    let lastPercent = -1;
    const onProgress = options?.onProgress;
    if (onProgress) {
        onProgress(0);
        lastPercent = 0;
    }
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
        await sendTx(connection, signer, createIx);
    }

    const limiter = createRateLimiter(config.maxRps);
    const payloads = chunks.map((chunk, index) => ({chunk, index}));

    await runWithConcurrency(payloads, config.maxConcurrency, async (payload) => {
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
        await sendTx(connection, signer, ix);
        completed += 1;
        if (onProgress && totalChunks > 0) {
            const percent = Math.floor((completed / totalChunks) * 100);
            if (percent !== lastPercent) {
                lastPercent = percent;
                onProgress(percent);
            }
        }
    });

    return session.toBase58();
}
