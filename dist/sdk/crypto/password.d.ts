/** Password-based encryption: PBKDF2-SHA256 (250k iterations) → AES-256-GCM. */
export interface PasswordEncryptResult {
    salt: string;
    iv: string;
    ciphertext: string;
}
/** Encrypt plaintext with a password. */
export declare function passwordEncrypt(password: string, plaintext: Uint8Array): Promise<PasswordEncryptResult>;
/** Decrypt data encrypted with passwordEncrypt. */
export declare function passwordDecrypt(password: string, saltHex: string, ivHex: string, ciphertextHex: string): Promise<Uint8Array>;
