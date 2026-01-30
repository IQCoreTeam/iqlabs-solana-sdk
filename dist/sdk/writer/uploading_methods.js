"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLinkedList = uploadLinkedList;
exports.uploadSession = uploadSession;
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const contract_1 = require("../../contract");
const concurrency_1 = require("../utils/concurrency");
const rate_limiter_1 = require("../utils/rate_limiter");
const session_speed_1 = require("../utils/session_speed");
const writer_utils_1 = require("./writer_utils");
const resolveUploadConfig = (options) => {
    const resolvedSpeed = (0, session_speed_1.resolveSessionSpeed)(options?.speed);
    const profile = session_speed_1.SESSION_SPEED_PROFILES[resolvedSpeed];
    return {
        maxConcurrency: profile.maxConcurrency,
        maxRps: profile.maxRps,
    };
};
//------------------------------------------------------------------------------------------------------------
async function uploadLinkedList(connection, signer, builder, user, codeAccount, chunks, method, onProgress, options) {
    const totalChunks = chunks.length;
    let lastPercent = -1;
    if (onProgress) {
        onProgress(0);
        lastPercent = 0;
    }
    const config = resolveUploadConfig(options);
    const limiter = (0, rate_limiter_1.createRateLimiter)(config.maxRps);
    let beforeTx = "Genesis";
    for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        if (limiter) {
            await limiter.wait();
        }
        const ix = (0, contract_1.sendCodeInstruction)(builder, {
            user,
            code_account: codeAccount,
            system_program: web3_js_1.SystemProgram.programId,
        }, {
            code: chunk,
            before_tx: beforeTx,
            method,
            decode_break: 0,
        });
        beforeTx = await (0, writer_utils_1.sendTx)(connection, signer, ix);
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
async function uploadSession(connection, signer, builder, programId, user, userState, seq, chunks, method, options) {
    const config = resolveUploadConfig(options);
    const totalChunks = chunks.length;
    let completed = 0;
    let lastPercent = -1;
    const onProgress = options?.onProgress;
    if (onProgress) {
        onProgress(0);
        lastPercent = 0;
    }
    const session = (0, contract_1.getSessionPda)(user, seq, programId);
    const sessionInfo = await connection.getAccountInfo(session);
    if (!sessionInfo) {
        const createIx = (0, contract_1.createSessionInstruction)(builder, {
            user,
            user_state: userState,
            session,
            system_program: web3_js_1.SystemProgram.programId,
        }, { seq: new anchor_1.BN(seq.toString()) });
        await (0, writer_utils_1.sendTx)(connection, signer, createIx);
    }
    const limiter = (0, rate_limiter_1.createRateLimiter)(config.maxRps);
    const payloads = chunks.map((chunk, index) => ({ chunk, index }));
    await (0, concurrency_1.runWithConcurrency)(payloads, config.maxConcurrency, async (payload) => {
        if (limiter) {
            await limiter.wait();
        }
        const ix = (0, contract_1.postChunkInstruction)(builder, { user, session }, {
            index: payload.index,
            chunk: payload.chunk,
            method,
            decode_break: 0,
        });
        await (0, writer_utils_1.sendTx)(connection, signer, ix);
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
