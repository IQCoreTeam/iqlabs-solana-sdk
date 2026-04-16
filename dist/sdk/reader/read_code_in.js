"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCodeIn = readCodeIn;
const connection_helper_1 = require("../utils/connection_helper");
const reading_flow_1 = require("./reading_flow");
async function readCodeIn(txSignature, speed, onProgress) {
    const connection = (0, connection_helper_1.getConnection)();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }
    return await (0, reading_flow_1.readUserInventoryCodeInFromTx)(tx, speed, onProgress);
}
