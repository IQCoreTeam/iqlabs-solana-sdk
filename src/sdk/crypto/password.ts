/**
 * Password-based encryption using PBKDF2 + AES-256-GCM.
 *
 * Derives a 256-bit AES key from the password via PBKDF2-SHA256
 * (250,000 iterations) with a random salt, then encrypts with AES-256-GCM.
 */

import { bytesToHex } from "./encoding";
import { pbkdf2Derive, aesEncrypt, aesDecrypt, getRandomBytes } from "./primitives";
import type { PasswordEncryptResult } from "./types";

/**
 * Encrypt data with a password.
 *
 * @param password - User-provided password
 * @param plaintext - Data to encrypt
 */
export async function passwordEncrypt(
    password: string,
    plaintext: Uint8Array,
): Promise<PasswordEncryptResult> {
    const salt = bytesToHex(getRandomBytes(16));
    const aesKey = await pbkdf2Derive(password, salt);
    const { iv, ciphertext } = await aesEncrypt(aesKey, plaintext);
    return { salt, iv, ciphertext };
}

/**
 * Decrypt data encrypted with passwordEncrypt.
 *
 * @param password - The same password used to encrypt
 * @param saltHex - Salt from PasswordEncryptResult
 * @param ivHex - IV from PasswordEncryptResult
 * @param ciphertextHex - Ciphertext from PasswordEncryptResult
 */
export async function passwordDecrypt(
    password: string,
    saltHex: string,
    ivHex: string,
    ciphertextHex: string,
): Promise<Uint8Array> {
    const aesKey = await pbkdf2Derive(password, saltHex);
    return aesDecrypt(aesKey, ivHex, ciphertextHex);
}
