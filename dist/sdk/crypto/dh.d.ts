/**
 * X25519 Diffie-Hellman encryption.
 *
 * Ephemeral X25519 ECDH → HKDF-SHA256 → AES-256-GCM.
 * Also derives deterministic X25519 keypairs from wallet signatures.
 */
export interface DhEncryptResult {
    senderPub: string;
    iv: string;
    ciphertext: string;
}
/** Derive a deterministic X25519 keypair from a wallet signature. */
export declare function deriveX25519Keypair(signMessage: (msg: Uint8Array) => Promise<Uint8Array>): Promise<{
    privKey: Uint8Array;
    pubKey: Uint8Array;
}>;
/** Encrypt plaintext to a recipient's X25519 public key (hex). */
export declare function dhEncrypt(recipientPubHex: string, plaintext: Uint8Array): Promise<DhEncryptResult>;
/** Decrypt data encrypted with dhEncrypt. */
export declare function dhDecrypt(privKey: Uint8Array, senderPubHex: string, ivHex: string, ciphertextHex: string): Promise<Uint8Array>;
