"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProgramId = exports.resolveContractRuntime = void 0;
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("../constants");
const constants_2 = require("./constants");
const DEFAULT_PROGRAM_IDS = {
    anchor: new web3_js_1.PublicKey(constants_2.DEFAULT_ANCHOR_PROGRAM_ID),
    pinocchio: new web3_js_1.PublicKey(constants_2.DEFAULT_PINOCCHIO_PROGRAM_ID),
};
const resolveContractRuntime = (mode = constants_1.DEFAULT_CONTRACT_MODE) => mode === "pinocchio" ? "pinocchio" : "anchor";
exports.resolveContractRuntime = resolveContractRuntime;
const getProgramId = (mode = constants_1.DEFAULT_CONTRACT_MODE) => DEFAULT_PROGRAM_IDS[(0, exports.resolveContractRuntime)(mode)];
exports.getProgramId = getProgramId;
