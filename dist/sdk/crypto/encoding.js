"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hexToBytes = hexToBytes;
exports.bytesToHex = bytesToHex;
exports.validatePubKey = validatePubKey;
/** Convert hex string to Uint8Array */
function hexToBytes(hex) {
    const len = hex.length >> 1;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++)
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}
/** Convert Uint8Array to hex string */
function bytesToHex(buf) {
    return Array.from(buf)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
function validatePubKey(hex, label) {
    if (!/^[0-9a-f]{64}$/i.test(hex)) {
        throw new Error(`${label}: must be 64 hex chars (32 bytes), got ${hex.length}`);
    }
    const bytes = hexToBytes(hex);
    if (bytes.every((b) => b === 0)) {
        throw new Error(`${label}: zero key is not valid`);
    }
    return bytes;
}
