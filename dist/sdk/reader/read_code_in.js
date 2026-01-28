"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCodeIn = readCodeIn;
const contract_1 = require("../../contract");
const connection_helper_1 = require("../utils/connection_helper");
const reader_context_1 = require("./reader_context");
const reading_flow_1 = require("./reading_flow");
async function readCodeIn(txSignature, speed, onProgress) {
    const connection = (0, connection_helper_1.getConnection)();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }
    const userMode = (0, contract_1.resolveContractRuntime)();
    const resolvedMode = (0, reader_context_1.resolveReaderModeFromTx)(tx) ?? userMode;
    return await (0, reading_flow_1.readUserInventoryCodeInFromTx)(tx, speed, resolvedMode, onProgress);
}
//# sourceMappingURL=read_code_in.js.map