/**
 * Multi-recipient X25519 encryption (PGP-style hybrid).
 *
 * 1. Generate random AES-256 CEK (content encryption key)
 * 2. Encrypt plaintext once with the CEK
 * 3. For each recipient: ephemeral ECDH → HKDF → AES-GCM wrap the CEK
 * 4. Decrypt: find your wrapped key entry, unwrap CEK, decrypt content
 */
export interface RecipientEntry {
    recipientPub: string;
    ephemeralPub: string;
    wrappedKey: string;
    wrapIv: string;
}
export interface MultiEncryptResult {
    recipients: RecipientEntry[];
    iv: string;
    ciphertext: string;
}
/** Encrypt plaintext to multiple recipients' X25519 public keys (hex). */
export declare function multiEncrypt(recipientPubHexes: string[], plaintext: Uint8Array): Promise<MultiEncryptResult>;
/** Decrypt multi-recipient encrypted data. Finds the matching recipient entry automatically. */
export declare function multiDecrypt(privKey: Uint8Array, pubKeyHex: string, encrypted: MultiEncryptResult): Promise<Uint8Array>;
