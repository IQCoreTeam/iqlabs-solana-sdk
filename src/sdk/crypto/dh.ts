/**
 * X25519 Diffie-Hellman encryption.
 *
 * Encrypts data to a recipient's X25519 public key using an ephemeral keypair.
 * The shared secret is derived via X25519 ECDH, then stretched with HKDF-SHA256
 * into an AES-256-GCM key.
 *
 * Also provides key derivation from a Solana wallet signature, allowing
 * deterministic X25519 keypair generation from any signing wallet.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — @noble/curves exports require .js suffix for Node CJS compat
import { x25519 } from "@noble/curves/ed25519.js";
import { hexToBytes, bytesToHex } from "./encoding";
import { hkdfDerive, aesEncrypt, aesDecrypt, getRandomBytes } from "./primitives";
import type { DhEncryptResult } from "./types";

const SALT = "iqlabs-dh-aes-v1";
const INFO = "aes-256-gcm-key";
const KEY_DERIVE_SALT = "iqlabs-x25519-v1";
const KEY_DERIVE_INFO = "x25519-private-key";
const KEY_DERIVE_MSG = "iqlabs-key-v1";

/**
 * Derive a deterministic X25519 keypair from a wallet signature.
 *
 * The wallet signs a fixed message, and the signature is fed through
 * HKDF-SHA256 to produce a 32-byte X25519 private key.
 *
 * @param signMessage - Function that signs a message with the user's wallet
 * @returns privKey (32 bytes) and pubKey (32 bytes)
 */
export async function deriveX25519Keypair(
    signMessage: (msg: Uint8Array) => Promise<Uint8Array>,
): Promise<{ privKey: Uint8Array; pubKey: Uint8Array }> {
    const enc = new TextEncoder();
    const sigBytes = await signMessage(enc.encode(KEY_DERIVE_MSG));
    const privKey = await hkdfDerive(sigBytes, KEY_DERIVE_SALT, KEY_DERIVE_INFO);
    return { privKey, pubKey: x25519.getPublicKey(privKey) };
}

/**
 * Encrypt data to a recipient's X25519 public key.
 *
 * Generates an ephemeral X25519 keypair, performs ECDH with the recipient's
 * public key, derives an AES-256-GCM key via HKDF, and encrypts the plaintext.
 *
 * @param recipientPubHex - Recipient's X25519 public key (64-char hex)
 * @param plaintext - Data to encrypt
 */
export async function dhEncrypt(
    recipientPubHex: string,
    plaintext: Uint8Array,
): Promise<DhEncryptResult> {
    const senderPriv = getRandomBytes(32);
    const senderPub = x25519.getPublicKey(senderPriv);
    const shared = x25519.getSharedSecret(senderPriv, hexToBytes(recipientPubHex));
    const aesKey = await hkdfDerive(shared, SALT, INFO);
    const { iv, ciphertext } = await aesEncrypt(aesKey, plaintext);
    return { senderPub: bytesToHex(senderPub), iv, ciphertext };
}

/**
 * Decrypt data encrypted with dhEncrypt.
 *
 * @param privKey - Recipient's X25519 private key (32 bytes)
 * @param senderPubHex - Ephemeral sender public key from DhEncryptResult
 * @param ivHex - IV from DhEncryptResult
 * @param ciphertextHex - Ciphertext from DhEncryptResult
 */
export async function dhDecrypt(
    privKey: Uint8Array,
    senderPubHex: string,
    ivHex: string,
    ciphertextHex: string,
): Promise<Uint8Array> {
    const shared = x25519.getSharedSecret(privKey, hexToBytes(senderPubHex));
    const aesKey = await hkdfDerive(shared, SALT, INFO);
    return aesDecrypt(aesKey, ivHex, ciphertextHex);
}
