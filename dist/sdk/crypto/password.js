"use strict";
/** Password-based encryption: PBKDF2-SHA256 (250k iterations) → AES-256-GCM. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordEncrypt = passwordEncrypt;
exports.passwordDecrypt = passwordDecrypt;
const encoding_1 = require("./encoding");
const primitives_1 = require("./primitives");
/** Encrypt plaintext with a password. */
async function passwordEncrypt(password, plaintext) {
    const salt = (0, encoding_1.bytesToHex)((0, primitives_1.getRandomBytes)(16));
    const aesKey = await (0, primitives_1.pbkdf2Derive)(password, salt);
    const { iv, ciphertext } = await (0, primitives_1.aesEncrypt)(aesKey, plaintext);
    return { salt, iv, ciphertext };
}
/** Decrypt data encrypted with passwordEncrypt. */
async function passwordDecrypt(password, saltHex, ivHex, ciphertextHex) {
    const aesKey = await (0, primitives_1.pbkdf2Derive)(password, saltHex);
    return (0, primitives_1.aesDecrypt)(aesKey, ivHex, ciphertextHex);
}
