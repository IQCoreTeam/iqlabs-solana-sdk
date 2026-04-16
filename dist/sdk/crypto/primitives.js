"use strict";
/** Low-level crypto primitives (Web Crypto API). Browser + Node 18+. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomBytes = getRandomBytes;
exports.hkdfDerive = hkdfDerive;
exports.aesEncrypt = aesEncrypt;
exports.aesDecrypt = aesDecrypt;
exports.pbkdf2Derive = pbkdf2Derive;
const encoding_1 = require("./encoding");
const enc = new TextEncoder();
function getSubtle() {
    const s = globalThis.crypto?.subtle;
    if (!s)
        throw new Error("Web Crypto API not available (requires browser or Node.js 18+)");
    return s;
}
function getRandomBytes(n) {
    return globalThis.crypto.getRandomValues(new Uint8Array(n));
}
/** Coerce Uint8Array to ArrayBuffer for strict TS compat */
function buf(data) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}
async function hkdfDerive(ikm, salt, info) {
    const subtle = getSubtle();
    const key = await subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
    const bits = await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: buf(enc.encode(salt)), info: buf(enc.encode(info)) }, key, 256);
    return new Uint8Array(bits);
}
async function aesEncrypt(keyBytes, plaintext) {
    const subtle = getSubtle();
    const key = await subtle.importKey("raw", buf(keyBytes), "AES-GCM", false, ["encrypt"]);
    const iv = getRandomBytes(12);
    const ct = await subtle.encrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(plaintext));
    return { iv: (0, encoding_1.bytesToHex)(iv), ciphertext: (0, encoding_1.bytesToHex)(new Uint8Array(ct)) };
}
async function aesDecrypt(keyBytes, ivHex, ciphertextHex) {
    const subtle = getSubtle();
    const key = await subtle.importKey("raw", buf(keyBytes), "AES-GCM", false, ["decrypt"]);
    const plain = await subtle.decrypt({ name: "AES-GCM", iv: buf((0, encoding_1.hexToBytes)(ivHex)) }, key, buf((0, encoding_1.hexToBytes)(ciphertextHex)));
    return new Uint8Array(plain);
}
async function pbkdf2Derive(password, saltHex) {
    const subtle = getSubtle();
    const km = await subtle.importKey("raw", buf(enc.encode(password)), "PBKDF2", false, ["deriveKey"]);
    const key = await subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: buf((0, encoding_1.hexToBytes)(saltHex)), iterations: 250000 }, km, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    return new Uint8Array(await subtle.exportKey("raw", key));
}
