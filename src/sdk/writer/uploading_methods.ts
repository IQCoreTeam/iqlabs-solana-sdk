import {BN} from "@coral-xyz/anchor";
import {Connection, SystemProgram, type PublicKey} from "@solana/web3.js";
import {
    createSessionInstruction,
    getSessionPda,
    postChunkInstruction,
    sendCodeInstruction,
    type InstructionBuilder,
    type ProgramProfile,
} from "../../contract";
import {SESSION_SPEED_PROFILES, resolveSessionSpeed} from "../utils/session_speed";
import type {SignerInput} from "../utils/wallet";
import {sendTx} from "./writer_utils";

const createRateLimiter = (maxRps: number) => {
    if (maxRps <= 0) {
        return null;
    }
    const minDelayMs = Math.max(1, Math.ceil(1000 / maxRps));
    let nextTime = 0;

    return {
        wait: async () => {
            const now = Date.now();
            const scheduled = Math.max(now, nextTime);
            nextTime = scheduled + minDelayMs;
            const delay = scheduled - now;
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        },
    };
};

const runWithConcurrency = async <T>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<void>,
) => {
    if (items.length === 0) {
        return;
    }
    const concurrency = Math.max(1, Math.min(limit, items.length));
    let cursor = 0;
    const runners = Array.from({length: concurrency}, async () => {
        while (true) {
            const index = cursor;
            cursor += 1;
            if (index >= items.length) {
                return;
            }
            await worker(items[index], index);
        }
    });
    await Promise.all(runners);
};

const resolveUploadConfig = (options?: { speed?: string }) => {
    const resolvedSpeed = resolveSessionSpeed(options?.speed);
    const profile = SESSION_SPEED_PROFILES[resolvedSpeed];
    return {
        maxConcurrency: profile.maxConcurrency,
        maxRps: profile.maxRps,
    };
};

export async function uploadLinkedList(
    connection: Connection,
    signer: SignerInput,
    builder: InstructionBuilder,
    user: PublicKey,
    codeAccount: PublicKey,
    chunks: string[],
    method: number,
) {
    let beforeTx = "Genesis";
    for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
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
    }
    return beforeTx;
}

export async function uploadSession(
    connection: Connection,
    signer: SignerInput,
    builder: InstructionBuilder,
    profile: ProgramProfile,
    user: PublicKey,
    userState: PublicKey,
    seq: bigint,
    chunks: string[],
    method: number,
    options?: {speed?: string},
) {
    const config = resolveUploadConfig(options);
    const session = getSessionPda(profile, user, seq);
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
                seq: new BN(seq.toString()),
                index: payload.index,
                chunk: payload.chunk,
                method,
                decode_break: 0,
            },
        );
        await sendTx(connection, signer, ix);
    });

    return session.toBase58();
}
