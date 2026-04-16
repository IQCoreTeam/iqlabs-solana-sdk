"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toWalletSigner = toWalletSigner;
exports.createBytesSigner = createBytesSigner;
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
/**
 * Build a {@link WalletSigner} from a bytes-based signer. Use this for
 * Solana Wallet Standard wallets (Privy v3, kit-era signers, MPC services,
 * backend signers) — anything that signs serialized transaction bytes and
 * returns signed bytes, rather than exposing a wallet-adapter object.
 */
function createBytesSigner(opts) {
    const publicKey = new web3_js_1.PublicKey(opts.address);
    const serialize = (tx) => tx instanceof web3_js_1.VersionedTransaction
        ? tx.serialize()
        : new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }));
    const deserialize = (bytes, template) => (template instanceof web3_js_1.VersionedTransaction
        ? web3_js_1.VersionedTransaction.deserialize(bytes)
        : web3_js_1.Transaction.from(bytes));
    const signOne = async (tx) => {
        const signed = await opts.signTransaction(serialize(tx));
        return deserialize(signed, tx);
    };
    return {
        publicKey,
        signTransaction: signOne,
        signAllTransactions: async (txs) => {
            if (opts.signAllTransactions) {
                const signed = await opts.signAllTransactions(txs.map(serialize));
                return signed.map((bytes, i) => deserialize(bytes, txs[i]));
            }
            const out = [];
            for (const tx of txs)
                out.push(await signOne(tx));
            return out;
        },
    };
}
