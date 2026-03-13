/**
 * Multi-recipient X25519 encryption (PGP-style hybrid).
 *
 * 1. Generate random AES-256 CEK (content encryption key)
 * 2. Encrypt plaintext once with the CEK
 * 3. For each recipient: ephemeral ECDH → HKDF → AES-GCM wrap the CEK
 * 4. Decrypt: find your wrapped key entry, unwrap CEK, decrypt content
 */

// @ts-ignore — @noble/curves exports require .js suffix for Node CJS compat
import { x25519 } from "@noble/curves/ed25519.js";
import { bytesToHex, validatePubKey } from "./encoding";
import { hkdfDerive, aesEncrypt, aesDecrypt, getRandomBytes } from "./primitives";

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

// Domain separation — distinct from single-recipient DH constants
const MULTI_HKDF_SALT = "iq-sdk-multi-dh-v1";
const MULTI_HKDF_INFO = "aes-256-gcm-wrap-key";

/** Encrypt plaintext to multiple recipients' X25519 public keys (hex). */
export async function multiEncrypt(
    recipientPubHexes: string[],
    plaintext: Uint8Array,
): Promise<MultiEncryptResult> {
    if (recipientPubHexes.length === 0) {
        throw new Error("At least one recipient required");
    }

    // Deduplicate recipients
    const unique = [...new Set(recipientPubHexes)];

    // Generate random CEK and encrypt content once
    const cek = getRandomBytes(32);
    const { iv, ciphertext } = await aesEncrypt(cek, plaintext);

    // Wrap the CEK for each recipient
    const recipients: RecipientEntry[] = await Promise.all(
        unique.map(async (recipientPubHex) => {
            const recipientPub = validatePubKey(recipientPubHex, "recipientPubHex");
            const ephPriv = getRandomBytes(32);
            const ephPub = x25519.getPublicKey(ephPriv);
            const shared = x25519.getSharedSecret(ephPriv, recipientPub);
            const wrapKey = await hkdfDerive(shared, MULTI_HKDF_SALT, MULTI_HKDF_INFO);
            const wrapped = await aesEncrypt(wrapKey, cek);
            return {
                recipientPub: recipientPubHex,
                ephemeralPub: bytesToHex(ephPub),
                wrappedKey: wrapped.ciphertext,
                wrapIv: wrapped.iv,
            };
        }),
    );

    return { recipients, iv, ciphertext };
}

/** Decrypt multi-recipient encrypted data. Finds the matching recipient entry automatically. */
export async function multiDecrypt(
    privKey: Uint8Array,
    pubKeyHex: string,
    encrypted: MultiEncryptResult,
): Promise<Uint8Array> {
    const entry = encrypted.recipients.find((r) => r.recipientPub === pubKeyHex);
    if (!entry) {
        throw new Error("No matching recipient entry found for this key");
    }

    const ephPub = validatePubKey(entry.ephemeralPub, "ephemeralPub");
    const shared = x25519.getSharedSecret(privKey, ephPub);
    const wrapKey = await hkdfDerive(shared, MULTI_HKDF_SALT, MULTI_HKDF_INFO);

    // Unwrap the CEK
    const cek = await aesDecrypt(wrapKey, entry.wrapIv, entry.wrappedKey);

    // Decrypt the content
    return aesDecrypt(cek, encrypted.iv, encrypted.ciphertext);
}
