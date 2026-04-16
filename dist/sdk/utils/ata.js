"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAssociatedTokenAddress = void 0;
exports.resolveAssociatedTokenAccount = resolveAssociatedTokenAccount;
const web3_js_1 = require("@solana/web3.js");
const writer_utils_1 = require("../writer/writer_utils");
const TOKEN_PROGRAM_ID = new web3_js_1.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new web3_js_1.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const findAssociatedTokenAddress = (owner, mint) => web3_js_1.PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID)[0];
exports.findAssociatedTokenAddress = findAssociatedTokenAddress;
async function resolveAssociatedTokenAccount(connection, owner, mint, requireExists = true) {
    const ata = (0, exports.findAssociatedTokenAddress)(owner, mint);
    let exists = await (0, writer_utils_1.getCachedAccountExists)(connection, ata);
    if (!exists && requireExists) {
        exists = await (0, writer_utils_1.refreshAccountExists)(connection, ata);
    }
    if (!exists) {
        if (requireExists) {
            throw new Error("missing signer_ata");
        }
        return null;
    }
    return ata;
}
