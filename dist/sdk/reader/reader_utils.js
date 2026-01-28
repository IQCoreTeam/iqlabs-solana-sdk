"use strict";
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
exports.extractCodeInPayload = exports.decodeUserInventoryCodeIn = exports.decodeReaderInstruction = void 0;
exports.fetchAccountTransactions = fetchAccountTransactions;
exports.getSessionPdaList = getSessionPdaList;
exports.fetchUserConnections = fetchUserConnections;
const web3_js_1 = require("@solana/web3.js");
const contract_1 = require("../../contract");
const constants_1 = require("../../constants");
const connection_helper_1 = require("../utils/connection_helper");
const rate_limiter_1 = require("../utils/rate_limiter");
const session_speed_1 = require("../utils/session_speed");
const reader_context_1 = require("./reader_context");
const { instructionCoder } = reader_context_1.readerContext;
const decodeReaderInstruction = (ix, accountKeys) => {
    const programId = accountKeys.get(ix.programIdIndex);
    if (!programId) {
        return null;
    }
    const isAnchor = programId.equals(reader_context_1.readerContext.anchorProgramId);
    const isPinocchio = programId.equals(reader_context_1.readerContext.pinocchioProgramId);
    if (!isAnchor && !isPinocchio) {
        return null;
    }
    return instructionCoder.decode(Buffer.from(ix.data));
};
exports.decodeReaderInstruction = decodeReaderInstruction;
// ----- user_inventory_code_in decoding -----
const decodeUserInventoryCodeIn = (tx, mode = constants_1.DEFAULT_CONTRACT_MODE) => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();
    const userMode = (0, contract_1.resolveContractRuntime)(mode);
    const resolvedMode = (0, reader_context_1.resolveReaderModeFromTx)(tx) ?? userMode;
    for (const ix of message.compiledInstructions) {
        const decoded = (0, exports.decodeReaderInstruction)(ix, accountKeys);
        if (!decoded) {
            continue;
        }
        if (decoded.name === "user_inventory_code_in" ||
            decoded.name === "user_inventory_code_in_for_free" ||
            decoded.name === "db_code_in" ||
            decoded.name === "db_instruction_code_in" ||
            decoded.name === "wallet_connection_code_in") {
            const data = decoded.data;
            return { onChainPath: data.on_chain_path, metadata: data.metadata };
        }
    }
    throw new Error("user_inventory_code_in instruction not found");
};
exports.decodeUserInventoryCodeIn = decodeUserInventoryCodeIn;
// ----- user_inventory_code_in metadata parsing -----
const extractCodeInPayload = (tx, mode = constants_1.DEFAULT_CONTRACT_MODE) => {
    const { onChainPath, metadata } = (0, exports.decodeUserInventoryCodeIn)(tx, mode);
    if (onChainPath.length > 0) {
        return { onChainPath, metadata, inlineData: null };
    }
    let data = null;
    let cleanedMetadata = metadata;
    try {
        const parsed = JSON.parse(metadata);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            if (Object.prototype.hasOwnProperty.call(parsed, "data")) {
                const dataValue = parsed.data;
                delete parsed.data;
                cleanedMetadata = JSON.stringify(parsed);
                if (typeof dataValue === "string") {
                    data = dataValue;
                }
                else if (dataValue !== undefined && dataValue !== null) {
                    data = JSON.stringify(dataValue);
                }
            }
        }
    }
    catch {
        // ignore malformed metadata
    }
    return { onChainPath, metadata: cleanedMetadata, inlineData: data };
};
exports.extractCodeInPayload = extractCodeInPayload;
// ----- account transaction & list fetchers -----
async function fetchAccountTransactions(// this use for bringing the db pda list, session chunk list, friend list , we dont check data here bacause it increases rpc call
account, options = {}) {
    const { before, limit } = options;
    if (typeof limit === "number" && limit <= 0) {
        return [];
    }
    const pubkey = typeof account === "string" ? new web3_js_1.PublicKey(account) : account;
    return (0, connection_helper_1.getConnection)().getSignaturesForAddress(pubkey, { before, limit });
}
async function getSessionPdaList(userPubkey, mode = constants_1.DEFAULT_CONTRACT_MODE) {
    const connection = (0, connection_helper_1.getConnection)();
    const user = new web3_js_1.PublicKey(userPubkey);
    const programId = (0, reader_context_1.resolveReaderProgramId)(mode);
    const userState = (0, contract_1.getUserPda)(user, programId);
    const info = await connection.getAccountInfo(userState);
    if (!info) {
        throw new Error("user_state not found");
    }
    const decoded = reader_context_1.readerContext.accountCoder.decode("UserState", info.data);
    const totalSessionFiles = BigInt(decoded.total_session_files.toString());
    const sessions = [];
    for (let seq = BigInt(0); seq < totalSessionFiles; seq += BigInt(1)) {
        const session = (0, contract_1.getSessionPda)(user, seq, programId);
        sessions.push(session.toBase58());
    }
    return sessions;
}
// ----- connection list fetcher -----
async function fetchUserConnections(userPubkey, options) {
    const { decodeConnectionMeta } = await Promise.resolve().then(() => __importStar(require("../utils/global_fetch")));
    // 1. Calculate UserState PDA
    const mode = options?.mode ?? constants_1.DEFAULT_CONTRACT_MODE;
    const programId = (0, reader_context_1.resolveReaderProgramId)(mode);
    const pubkey = typeof userPubkey === "string" ? new web3_js_1.PublicKey(userPubkey) : userPubkey;
    const userState = (0, contract_1.getUserPda)(pubkey, programId);
    // 2. Fetch transaction history
    const { before, limit } = options ?? {};
    const signatures = await fetchAccountTransactions(userState, { before, limit });
    // 3. Create rate limiter based on speed profile
    const speedKey = (0, session_speed_1.resolveSessionSpeed)(options?.speed);
    const profile = session_speed_1.SESSION_SPEED_PROFILES[speedKey];
    const rateLimiter = (0, rate_limiter_1.createRateLimiter)(profile.maxRps);
    // 4. Filter request_connection instructions and collect Connection PDA addresses
    const connectionPdaSet = new Set();
    const connectionPdaData = [];
    for (const sig of signatures) {
        if (rateLimiter) {
            await rateLimiter.wait();
        }
        const connection = (0, connection_helper_1.getConnection)();
        let tx;
        try {
            tx = await connection.getTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0,
            });
        }
        catch {
            continue;
        }
        if (!tx) {
            continue;
        }
        const message = tx.transaction.message;
        const accountKeys = message.getAccountKeys();
        for (const ix of message.compiledInstructions) {
            const decoded = (0, exports.decodeReaderInstruction)(ix, accountKeys);
            if (!decoded || decoded.name !== "request_connection") {
                continue;
            }
            // Extract connection_table PDA from instruction accounts
            // connection_table is at index 2 in the accounts array
            const connectionTablePubkey = accountKeys.get(ix.accountKeyIndexes[2]);
            if (!connectionTablePubkey) {
                continue;
            }
            const pdaKey = connectionTablePubkey.toBase58();
            if (!connectionPdaSet.has(pdaKey)) {
                connectionPdaSet.add(pdaKey);
                connectionPdaData.push({
                    connectionPda: connectionTablePubkey,
                    timestamp: sig.blockTime ?? undefined,
                });
            }
        }
    }
    // 5. Fetch Connection PDA data with rate limiting
    const connection = (0, connection_helper_1.getConnection)();
    const connections = await Promise.all(connectionPdaData.map(async ({ connectionPda, timestamp }) => {
        if (rateLimiter) {
            await rateLimiter.wait();
        }
        try {
            const info = await connection.getAccountInfo(connectionPda);
            if (!info) {
                return null;
            }
            // Decode all info from Connection PDA
            const meta = decodeConnectionMeta(info.data);
            const partyA = meta.partyA.toBase58();
            const partyB = meta.partyB.toBase58();
            const statusNum = meta.status;
            const status = statusNum === 0 ? "pending" :
                statusNum === 1 ? "approved" :
                    statusNum === 2 ? "blocked" : "pending";
            const requester = meta.requester === 0 ? "a" : "b";
            const blocker = meta.blocker === 0 ? "a" :
                meta.blocker === 1 ? "b" : "none";
            return {
                dbRootId: meta.dbRootId,
                connectionPda: connectionPda.toBase58(),
                partyA,
                partyB,
                status,
                requester,
                blocker,
                timestamp,
            };
        }
        catch {
            return null;
        }
    }));
    return connections.filter((c) => c !== null);
}
//# sourceMappingURL=reader_utils.js.map