"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readerContext = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const contract_1 = require("../../contract");
const IDL = require("../../../idl/code_in.json");
exports.readerContext = {
    idl: IDL,
    instructionCoder: new anchor_1.BorshInstructionCoder(IDL),
    accountCoder: new anchor_1.BorshAccountsCoder(IDL),
    anchorProgramId: new web3_js_1.PublicKey(contract_1.DEFAULT_ANCHOR_PROGRAM_ID),
};
