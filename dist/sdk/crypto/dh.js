"use strict";
/**
 * X25519 Diffie-Hellman encryption.
 *
 * Ephemeral X25519 ECDH → HKDF-SHA256 → AES-256-GCM.
 * Also derives deterministic X25519 keypairs from wallet signatures.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveX25519Keypair = deriveX25519Keypair;
exports.dhEncrypt = dhEncrypt;
exports.dhDecrypt = dhDecrypt;
// @ts-ignore — @noble/curves exports require .js suffix for Node CJS compat
const ed25519_js_1 = require("@noble/curves/ed25519.js");
const encoding_1 = require("./encoding");
const primitives_1 = require("./primitives");
// Protocol constants for HKDF domain separation.
// These are NOT secrets — they prevent cross-protocol key reuse.
// Changing them would break all existing encrypted data.
const DH_HKDF_SALT = "iq-sdk-dh-aes-v1";
const DH_HKDF_INFO = "aes-256-gcm-key";
const KEY_DERIVE_SALT = "iq-sdk-x25519-v1";
const KEY_DERIVE_INFO = "x25519-private-key";
const KEY_DERIVE_MSG = "iq-sdk-derive-encryption-key-v1";
/** Derive a deterministic X25519 keypair from a wallet signature. */
async function deriveX25519Keypair(signMessage) {
    const sigBytes = await signMessage(new TextEncoder().encode(KEY_DERIVE_MSG));
    const privKey = await (0, primitives_1.hkdfDerive)(sigBytes, KEY_DERIVE_SALT, KEY_DERIVE_INFO);
    return { privKey, pubKey: ed25519_js_1.x25519.getPublicKey(privKey) };
}
/** Encrypt plaintext to a recipient's X25519 public key (hex). */
async function dhEncrypt(recipientPubHex, plaintext) {
    const recipientPub = (0, encoding_1.validatePubKey)(recipientPubHex, "recipientPubHex");
    const senderPriv = (0, primitives_1.getRandomBytes)(32);
    const senderPub = ed25519_js_1.x25519.getPublicKey(senderPriv);
    const shared = ed25519_js_1.x25519.getSharedSecret(senderPriv, recipientPub);
    const aesKey = await (0, primitives_1.hkdfDerive)(shared, DH_HKDF_SALT, DH_HKDF_INFO);
    const { iv, ciphertext } = await (0, primitives_1.aesEncrypt)(aesKey, plaintext);
    return { senderPub: (0, encoding_1.bytesToHex)(senderPub), iv, ciphertext };
}
/** Decrypt data encrypted with dhEncrypt. */
async function dhDecrypt(privKey, senderPubHex, ivHex, ciphertextHex) {
    const senderPub = (0, encoding_1.validatePubKey)(senderPubHex, "senderPubHex");
    const shared = ed25519_js_1.x25519.getSharedSecret(privKey, senderPub);
    const aesKey = await (0, primitives_1.hkdfDerive)(shared, DH_HKDF_SALT, DH_HKDF_INFO);
    return (0, primitives_1.aesDecrypt)(aesKey, ivHex, ciphertextHex);
}
