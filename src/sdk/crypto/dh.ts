/**
 * X25519 Diffie-Hellman encryption.
 *
 * Ephemeral X25519 ECDH → HKDF-SHA256 → AES-256-GCM.
 * Also derives deterministic X25519 keypairs from wallet signatures.
 */

// @ts-ignore — @noble/curves exports require .js suffix for Node CJS compat
import { x25519 } from "@noble/curves/ed25519.js";
import { bytesToHex, validatePubKey } from "./encoding";
import { hkdfDerive, aesEncrypt, aesDecrypt, getRandomBytes } from "./primitives";

export interface DhEncryptResult {
    senderPub: string;
    iv: string;
    ciphertext: string;
}

// Protocol constants for HKDF domain separation.
// These are NOT secrets — they prevent cross-protocol key reuse.
// Changing them would break all existing encrypted data.
const DH_HKDF_SALT = "iq-sdk-dh-aes-v1";
const DH_HKDF_INFO = "aes-256-gcm-key";
const KEY_DERIVE_SALT = "iq-sdk-x25519-v1";
const KEY_DERIVE_INFO = "x25519-private-key";
const KEY_DERIVE_MSG = "iq-sdk-derive-encryption-key-v1";

/** Derive a deterministic X25519 keypair from a wallet signature. */
export async function deriveX25519Keypair(
    signMessage: (msg: Uint8Array) => Promise<Uint8Array>,
): Promise<{ privKey: Uint8Array; pubKey: Uint8Array }> {
    const sigBytes = await signMessage(new TextEncoder().encode(KEY_DERIVE_MSG));
    const privKey = await hkdfDerive(sigBytes, KEY_DERIVE_SALT, KEY_DERIVE_INFO);
    return { privKey, pubKey: x25519.getPublicKey(privKey) };
}

/** Encrypt plaintext to a recipient's X25519 public key (hex). */
export async function dhEncrypt(recipientPubHex: string, plaintext: Uint8Array): Promise<DhEncryptResult> {
    const recipientPub = validatePubKey(recipientPubHex, "recipientPubHex");
    const senderPriv = getRandomBytes(32);
    const senderPub = x25519.getPublicKey(senderPriv);
    const shared = x25519.getSharedSecret(senderPriv, recipientPub);
    const aesKey = await hkdfDerive(shared, DH_HKDF_SALT, DH_HKDF_INFO);
    const { iv, ciphertext } = await aesEncrypt(aesKey, plaintext);
    return { senderPub: bytesToHex(senderPub), iv, ciphertext };
}

/** Decrypt data encrypted with dhEncrypt. */
export async function dhDecrypt(
    privKey: Uint8Array,
    senderPubHex: string,
    ivHex: string,
    ciphertextHex: string,
): Promise<Uint8Array> {
    const senderPub = validatePubKey(senderPubHex, "senderPubHex");
    const shared = x25519.getSharedSecret(privKey, senderPub);
    const aesKey = await hkdfDerive(shared, DH_HKDF_SALT, DH_HKDF_INFO);
    return aesDecrypt(aesKey, ivHex, ciphertextHex);
}
