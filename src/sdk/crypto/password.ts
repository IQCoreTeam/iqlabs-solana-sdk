/** Password-based encryption: PBKDF2-SHA256 (250k iterations) → AES-256-GCM. */

import { bytesToHex } from "./encoding";
import { pbkdf2Derive, aesEncrypt, aesDecrypt, getRandomBytes } from "./primitives";

export interface PasswordEncryptResult {
    salt: string;
    iv: string;
    ciphertext: string;
}

/** Encrypt plaintext with a password. */
export async function passwordEncrypt(password: string, plaintext: Uint8Array): Promise<PasswordEncryptResult> {
    const salt = bytesToHex(getRandomBytes(16));
    const aesKey = await pbkdf2Derive(password, salt);
    const { iv, ciphertext } = await aesEncrypt(aesKey, plaintext);
    return { salt, iv, ciphertext };
}

/** Decrypt data encrypted with passwordEncrypt. */
export async function passwordDecrypt(
    password: string,
    saltHex: string,
    ivHex: string,
    ciphertextHex: string,
): Promise<Uint8Array> {
    const aesKey = await pbkdf2Derive(password, saltHex);
    return aesDecrypt(aesKey, ivHex, ciphertextHex);
}
