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
exports.fetchInventoryTransactions = void 0;
exports.readInventoryMetadata = readInventoryMetadata;
exports.readSession = readSession;
exports.readLinkedListFromTail = readLinkedListFromTail;
exports.readUserInventoryCodeInFromTx = readUserInventoryCodeInFromTx;
exports.readUserState = readUserState;
const web3_js_1 = require("@solana/web3.js");
const contract_1 = require("../../contract");
const constants_1 = require("../../constants");
const connection_helper_1 = require("../utils/connection_helper");
const reader_profile_1 = require("./reader_profile");
const reading_methods_1 = require("./reading_methods");
const reader_context_1 = require("./reader_context");
const reader_utils_1 = require("./reader_utils");
const { accountCoder } = reader_context_1.readerContext;
const SIG_MIN_LEN = 80;
async function readInventoryMetadata(txSignature) {
    const connection = (0, connection_helper_1.getConnection)();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }
    return (0, reader_utils_1.decodeUserInventoryCodeIn)(tx);
}
//high level but I put this because I think people should use this a lot
const fetchInventoryTransactions = async (publicKey, limit, before) => {
    const inventoryPda = (0, contract_1.getUserInventoryPda)(publicKey);
    const signatures = await (0, reader_utils_1.fetchAccountTransactions)(inventoryPda, {
        limit,
        before,
    });
    const withMetadata = [];
    for (const sig of signatures) {
        try {
            const inventoryMetadata = await readInventoryMetadata(sig.signature);
            withMetadata.push({ ...sig, ...inventoryMetadata });
        }
        catch (err) {
            if (err instanceof Error && err.message === "user_inventory_code_in instruction not found") {
                continue;
            }
            throw err;
        }
    }
    return withMetadata;
};
exports.fetchInventoryTransactions = fetchInventoryTransactions;
async function readSession(sessionPubkey, readOption, speed, mode = constants_1.DEFAULT_CONTRACT_MODE, onProgress) {
    const connection = (0, connection_helper_1.getReaderConnection)(readOption.freshness);
    const info = await connection.getAccountInfo(new web3_js_1.PublicKey(sessionPubkey));
    if (!info) {
        throw new Error("session account not found");
    }
    return (0, reading_methods_1.readSessionResult)(sessionPubkey, readOption, speed, mode, onProgress);
}
async function readLinkedListFromTail(tailTx, readOption, mode = constants_1.DEFAULT_CONTRACT_MODE, onProgress, expectedTotalChunks) {
    const connection = (0, connection_helper_1.getReaderConnection)(readOption.freshness);
    const tx = await connection.getTransaction(tailTx, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("tail transaction not found");
    }
    return (0, reading_methods_1.readLinkedListResult)(tailTx, readOption, mode, onProgress, expectedTotalChunks);
}
async function readUserInventoryCodeInFromTx(tx, speed, mode = constants_1.DEFAULT_CONTRACT_MODE, onProgress) {
    const blockTime = tx.blockTime;
    const userMode = (0, contract_1.resolveContractRuntime)(mode);
    const resolvedMode = (0, reader_context_1.resolveReaderModeFromTx)(tx) ?? userMode;
    const { onChainPath, metadata, inlineData } = (0, reader_utils_1.extractCodeInPayload)(tx, resolvedMode);
    let totalChunks;
    try {
        const parsed = JSON.parse(metadata);
        const rawTotal = parsed.total_chunks;
        if (typeof rawTotal === "number" && Number.isFinite(rawTotal)) {
            totalChunks = rawTotal;
        }
        else if (typeof rawTotal === "string") {
            const parsedTotal = Number.parseInt(rawTotal, 10);
            if (!Number.isNaN(parsedTotal)) {
                totalChunks = parsedTotal;
            }
        }
    }
    catch {
        // ignore malformed metadata
    }
    if (onChainPath.length === 0) {
        if (onProgress) {
            onProgress(100);
        }
        return { metadata, data: inlineData };
    }
    const readOption = (0, reader_profile_1.resolveReadMode)(onChainPath, blockTime);
    const kind = onChainPath.length >= SIG_MIN_LEN ? "linked_list" : "session";
    if (kind === "session") {
        const { result } = await readSession(onChainPath, readOption, speed, resolvedMode, onProgress);
        return { metadata, data: result };
    }
    const { result } = await readLinkedListFromTail(onChainPath, readOption, resolvedMode, onProgress, totalChunks);
    return { metadata, data: result };
}
async function readUserState(userPubkey, mode = constants_1.DEFAULT_CONTRACT_MODE) {
    const connection = (0, connection_helper_1.getConnection)();
    const user = new web3_js_1.PublicKey(userPubkey);
    const programId = (0, reader_context_1.resolveReaderProgramId)(mode);
    const userState = (0, contract_1.getUserPda)(user, programId);
    const info = await connection.getAccountInfo(userState);
    if (!info) {
        throw new Error("user_state not found");
    }
    const decoded = accountCoder.decode("UserState", info.data);
    const rawMetadata = Buffer.from(decoded.metadata).toString("utf8");
    const metadata = rawMetadata.replace(/\0+$/, "").trim() || null;
    const totalSessionFiles = BigInt(decoded.total_session_files.toString());
    if (metadata) {
        const { readCodeIn } = await Promise.resolve().then(() => __importStar(require("./read_code_in")));
        const { data } = await readCodeIn(metadata);
        const profileData = data ?? undefined;
        return {
            owner: decoded.owner.toBase58(),
            metadata,
            totalSessionFiles,
            profileData,
        };
    }
    return {
        owner: decoded.owner.toBase58(),
        metadata: null,
        totalSessionFiles,
    };
}
//# sourceMappingURL=reading_flow.js.map