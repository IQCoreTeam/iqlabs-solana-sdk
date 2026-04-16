"use strict";
/**
 * Multi-recipient X25519 encryption (PGP-style hybrid).
 *
 * 1. Generate random AES-256 CEK (content encryption key)
 * 2. Encrypt plaintext once with the CEK
 * 3. For each recipient: ephemeral ECDH → HKDF → AES-GCM wrap the CEK
 * 4. Decrypt: find your wrapped key entry, unwrap CEK, decrypt content
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiEncrypt = multiEncrypt;
exports.multiDecrypt = multiDecrypt;
// @ts-ignore — @noble/curves exports require .js suffix for Node CJS compat
const ed25519_js_1 = require("@noble/curves/ed25519.js");
const encoding_1 = require("./encoding");
const primitives_1 = require("./primitives");
// Domain separation — distinct from single-recipient DH constants
const MULTI_HKDF_SALT = "iq-sdk-multi-dh-v1";
const MULTI_HKDF_INFO = "aes-256-gcm-wrap-key";
/** Encrypt plaintext to multiple recipients' X25519 public keys (hex). */
async function multiEncrypt(recipientPubHexes, plaintext) {
    if (recipientPubHexes.length === 0) {
        throw new Error("At least one recipient required");
    }
    // Deduplicate recipients
    const unique = [...new Set(recipientPubHexes)];
    // Generate random CEK and encrypt content once
    const cek = (0, primitives_1.getRandomBytes)(32);
    const { iv, ciphertext } = await (0, primitives_1.aesEncrypt)(cek, plaintext);
    // Wrap the CEK for each recipient
    const recipients = await Promise.all(unique.map(async (recipientPubHex) => {
        const recipientPub = (0, encoding_1.validatePubKey)(recipientPubHex, "recipientPubHex");
        const ephPriv = (0, primitives_1.getRandomBytes)(32);
        const ephPub = ed25519_js_1.x25519.getPublicKey(ephPriv);
        const shared = ed25519_js_1.x25519.getSharedSecret(ephPriv, recipientPub);
        const wrapKey = await (0, primitives_1.hkdfDerive)(shared, MULTI_HKDF_SALT, MULTI_HKDF_INFO);
        const wrapped = await (0, primitives_1.aesEncrypt)(wrapKey, cek);
        return {
            recipientPub: recipientPubHex,
            ephemeralPub: (0, encoding_1.bytesToHex)(ephPub),
            wrappedKey: wrapped.ciphertext,
            wrapIv: wrapped.iv,
        };
    }));
    return { recipients, iv, ciphertext };
}
/** Decrypt multi-recipient encrypted data. Finds the matching recipient entry automatically. */
async function multiDecrypt(privKey, pubKeyHex, encrypted) {
    const entry = encrypted.recipients.find((r) => r.recipientPub === pubKeyHex);
    if (!entry) {
        throw new Error("No matching recipient entry found for this key");
    }
    const ephPub = (0, encoding_1.validatePubKey)(entry.ephemeralPub, "ephemeralPub");
    const shared = ed25519_js_1.x25519.getSharedSecret(privKey, ephPub);
    const wrapKey = await (0, primitives_1.hkdfDerive)(shared, MULTI_HKDF_SALT, MULTI_HKDF_INFO);
    // Unwrap the CEK
    const cek = await (0, primitives_1.aesDecrypt)(wrapKey, entry.wrapIv, entry.wrappedKey);
    // Decrypt the content
    return (0, primitives_1.aesDecrypt)(cek, encrypted.iv, encrypted.ciphertext);
}
