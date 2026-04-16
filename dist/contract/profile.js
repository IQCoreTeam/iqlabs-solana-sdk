"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROGRAM_ID = void 0;
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("./constants");
exports.PROGRAM_ID = new web3_js_1.PublicKey(constants_1.DEFAULT_ANCHOR_PROGRAM_ID);
