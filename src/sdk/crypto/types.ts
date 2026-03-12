/** Result of DH (X25519) encryption */
export interface DhEncryptResult {
    /** Ephemeral sender public key (hex) */
    senderPub: string;
    /** AES-GCM initialization vector (hex) */
    iv: string;
    /** AES-256-GCM ciphertext (hex) */
    ciphertext: string;
}

/** Result of password-based encryption */
export interface PasswordEncryptResult {
    /** PBKDF2 salt (hex) */
    salt: string;
    /** AES-GCM initialization vector (hex) */
    iv: string;
    /** AES-256-GCM ciphertext (hex) */
    ciphertext: string;
}
