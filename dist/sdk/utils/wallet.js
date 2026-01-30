"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toWalletSigner = toWalletSigner;
const web3_js_1 = require("@solana/web3.js");
function isWalletSigner(signer) {
    return typeof signer.signTransaction === "function";
}
function toWalletSigner(signer) {
    if (isWalletSigner(signer)) {
        return signer;
    }
    const keypair = signer;
    return {
        publicKey: keypair.publicKey,
        signTransaction: async (tx) => {
            if (tx instanceof web3_js_1.Transaction) {
                tx.partialSign(keypair);
            }
            else {
                tx.sign([keypair]);
            }
            return tx;
        },
        signAllTransactions: async (txs) => {
            for (const tx of txs) {
                if (tx instanceof web3_js_1.Transaction) {
                    tx.partialSign(keypair);
                }
                else {
                    tx.sign([keypair]);
                }
            }
            return txs;
        },
    };
}
