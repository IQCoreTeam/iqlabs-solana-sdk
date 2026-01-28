"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedAccountExists = getCachedAccountExists;
exports.refreshAccountExists = refreshAccountExists;
exports.readMagicBytes = readMagicBytes;
exports.sendTx = sendTx;
exports.ensureUserInitialized = ensureUserInitialized;
const web3_js_1 = require("@solana/web3.js");
const contract_1 = require("../../contract");
const wallet_1 = require("../utils/wallet");
const ACCOUNT_CACHE_TTL_MS = 120000;
const accountExistsCache = new Map();
const getCacheKey = (pubkey) => pubkey.toBase58();
const readCache = (key) => {
    const entry = accountExistsCache.get(key);
    if (!entry) {
        return null;
    }
    if (Date.now() > entry.expiresAt) {
        accountExistsCache.delete(key);
        return null;
    }
    return entry.exists;
};
const writeCache = (key, exists) => {
    accountExistsCache.set(key, {
        exists,
        expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS,
    });
};
async function getCachedAccountExists(connection, pubkey) {
    const key = getCacheKey(pubkey);
    const cached = readCache(key);
    if (cached !== null) {
        return cached;
    }
    const info = await connection.getAccountInfo(pubkey);
    const exists = Boolean(info);
    writeCache(key, exists);
    return exists;
}
async function refreshAccountExists(connection, pubkey) {
    const key = getCacheKey(pubkey);
    const info = await connection.getAccountInfo(pubkey);
    const exists = Boolean(info);
    writeCache(key, exists);
    return exists;
}
const markAccountExists = (pubkey, exists = true) => {
    writeCache(getCacheKey(pubkey), exists);
};
const MAGIC_SIGNATURES = [
    { ext: "png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    { ext: "jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
    { ext: "gif", mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
    { ext: "pdf", mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
    { ext: "zip", mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
];
const looksBase64 = (value) => {
    const trimmed = value.trim();
    return trimmed.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(trimmed);
};
const toBytes = (value) => {
    if (looksBase64(value)) {
        const decoded = Buffer.from(value, "base64");
        if (decoded.length > 0) {
            return decoded;
        }
    }
    return Buffer.from(value, "utf8");
};
const startsWith = (data, bytes) => {
    if (data.length < bytes.length) {
        return false;
    }
    for (let i = 0; i < bytes.length; i += 1) {
        if (data[i] !== bytes[i]) {
            return false;
        }
    }
    return true;
};
const isWebp = (data) => {
    if (data.length < 12) {
        return false;
    }
    return (data[0] === 0x52 &&
        data[1] === 0x49 &&
        data[2] === 0x46 &&
        data[3] === 0x46 &&
        data[8] === 0x57 &&
        data[9] === 0x45 &&
        data[10] === 0x42 &&
        data[11] === 0x50);
};
const isMp4 = (data) => {
    if (data.length < 12) {
        return false;
    }
    return data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70;
};
function readMagicBytes(chunk) {
    const data = toBytes(chunk);
    for (const sig of MAGIC_SIGNATURES) {
        if (startsWith(data, sig.bytes)) {
            return { ext: sig.ext, mime: sig.mime };
        }
    }
    if (isWebp(data)) {
        return { ext: "webp", mime: "image/webp" };
    }
    if (isMp4(data)) {
        return { ext: "mp4", mime: "video/mp4" };
    }
    return { ext: "bin", mime: "application/octet-stream" };
}
async function sendTx(connection, signer, instructions) {
    const wallet = (0, wallet_1.toWalletSigner)(signer);
    const tx = new web3_js_1.Transaction();
    if (Array.isArray(instructions)) {
        tx.add(...instructions);
    }
    else {
        tx.add(instructions);
    }
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;
    const signed = await wallet.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
    return signature;
}
async function ensureUserInitialized(connection, signer, builder, accounts) {
    let exists = await getCachedAccountExists(connection, accounts.user_inventory);
    if (!exists) {
        exists = await refreshAccountExists(connection, accounts.user_inventory);
    }
    if (exists) {
        return;
    }
    const ix = (0, contract_1.userInitializeInstruction)(builder, accounts);
    await sendTx(connection, signer, ix);
    markAccountExists(accounts.user_inventory, true);
}
//# sourceMappingURL=writer_utils.js.map