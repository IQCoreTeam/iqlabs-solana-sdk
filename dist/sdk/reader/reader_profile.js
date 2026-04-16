"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveReadMode = void 0;
exports.decideReadMode = decideReadMode;
const connection_helper_1 = require("../utils/connection_helper");
const reader_utils_1 = require("./reader_utils");
const constants_1 = require("../constants");
const DAY_SECONDS = 86400;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const resolveOnChainPath = (tx) => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys(tx.meta?.loadedAddresses
        ? { accountKeysFromLookups: tx.meta.loadedAddresses }
        : undefined);
    for (const ix of message.compiledInstructions) {
        const decoded = (0, reader_utils_1.decodeReaderInstruction)(ix, accountKeys);
        if (!decoded) {
            continue;
        }
        if (reader_utils_1.CODE_IN_INSTRUCTION_NAMES.includes(decoded.name)) {
            const data = decoded.data;
            return data.on_chain_path;
        }
    }
    throw new Error("user_inventory_code_in instruction not found");
};
const resolveReadMode = (onChainPath, blockTime) => {
    const now = Math.floor(Date.now() / 1000);
    const ageSeconds = typeof blockTime === "number" ? Math.max(0, now - blockTime) : null;
    if (onChainPath.length === 0) {
        const freshness = ageSeconds !== null && ageSeconds <= DAY_SECONDS ? "fresh" : "recent";
        return { freshness };
    }
    const kind = onChainPath.length >= constants_1.SIG_MIN_LEN ? "linked_list" : "session";
    if (kind === "linked_list") {
        const freshness = ageSeconds !== null && ageSeconds <= DAY_SECONDS ? "fresh" : "recent";
        return { freshness };
    }
    if (ageSeconds !== null && ageSeconds <= DAY_SECONDS) {
        return { freshness: "fresh" };
    }
    if (ageSeconds !== null && ageSeconds <= WEEK_SECONDS) {
        return { freshness: "recent" };
    }
    return { freshness: "archive" };
};
exports.resolveReadMode = resolveReadMode;
async function decideReadMode(txSignature) {
    const connection = (0, connection_helper_1.getConnection)();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }
    const onChainPath = resolveOnChainPath(tx);
    return (0, exports.resolveReadMode)(onChainPath, tx.blockTime);
}
