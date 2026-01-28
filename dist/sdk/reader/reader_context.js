"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveReaderModeFromTx = exports.resolveReaderProgramId = exports.readerContext = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const contract_1 = require("../../contract");
const constants_1 = require("../../constants");
const IDL = require("../../../idl/code_in.json");
exports.readerContext = {
    idl: IDL,
    instructionCoder: new anchor_1.BorshInstructionCoder(IDL),
    accountCoder: new anchor_1.BorshAccountsCoder(IDL),
    anchorProgramId: new web3_js_1.PublicKey(contract_1.DEFAULT_ANCHOR_PROGRAM_ID),
    pinocchioProgramId: new web3_js_1.PublicKey(contract_1.DEFAULT_PINOCCHIO_PROGRAM_ID),
};
const resolveReaderProgramId = (mode = constants_1.DEFAULT_CONTRACT_MODE) => {
    const runtime = (0, contract_1.resolveContractRuntime)(mode);
    return runtime === "anchor"
        ? exports.readerContext.anchorProgramId
        : exports.readerContext.pinocchioProgramId;
};
exports.resolveReaderProgramId = resolveReaderProgramId;
const resolveReaderModeFromTx = (tx) => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys(tx.meta?.loadedAddresses
        ? { accountKeysFromLookups: tx.meta.loadedAddresses }
        : undefined);
    let sawAnchor = false;
    let sawPinocchio = false;
    for (const ix of message.compiledInstructions) {
        const programId = accountKeys.get(ix.programIdIndex);
        if (!programId) {
            continue;
        }
        if (programId.equals(exports.readerContext.anchorProgramId)) {
            sawAnchor = true;
        }
        if (programId.equals(exports.readerContext.pinocchioProgramId)) {
            sawPinocchio = true;
        }
    }
    if (sawAnchor && !sawPinocchio) {
        return "anchor";
    }
    if (sawPinocchio && !sawAnchor) {
        return "pinocchio";
    }
    return (0, contract_1.resolveContractRuntime)(constants_1.DEFAULT_CONTRACT_MODE);
};
exports.resolveReaderModeFromTx = resolveReaderModeFromTx;
//# sourceMappingURL=reader_context.js.map