/**
 * Low-level crypto primitives using Web Crypto API.
 * Works in browsers and Node.js 18+.
 */

import { hexToBytes, bytesToHex } from "./encoding";

const enc = new TextEncoder();

function getSubtle(): SubtleCrypto {
    const s = globalThis.crypto?.subtle;
    if (!s) throw new Error("Web Crypto API not available (requires browser or Node.js 18+)");
    return s;
}

function getRandomBytes(n: number): Uint8Array {
    return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

/** Coerce Uint8Array to ArrayBuffer for strict TS compat */
function buf(data: Uint8Array): ArrayBuffer {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

// ── HKDF-SHA256 ─────────────────────────────────────────────────────────────

export async function hkdfDerive(ikm: Uint8Array, salt: string, info: string): Promise<Uint8Array> {
    const subtle = getSubtle();
    const key = await subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
    const bits = await subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: buf(enc.encode(salt)), info: buf(enc.encode(info)) },
        key,
        256,
    );
    return new Uint8Array(bits);
}

// ── AES-256-GCM ─────────────────────────────────────────────────────────────

export async function aesEncrypt(
    keyBytes: Uint8Array,
    plaintext: Uint8Array,
): Promise<{ iv: string; ciphertext: string }> {
    const subtle = getSubtle();
    const key = await subtle.importKey("raw", buf(keyBytes), "AES-GCM", false, ["encrypt"]);
    const iv = getRandomBytes(12);
    const ct = await subtle.encrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(plaintext));
    return { iv: bytesToHex(iv), ciphertext: bytesToHex(new Uint8Array(ct)) };
}

export async function aesDecrypt(
    keyBytes: Uint8Array,
    ivHex: string,
    ciphertextHex: string,
): Promise<Uint8Array> {
    const subtle = getSubtle();
    const key = await subtle.importKey("raw", buf(keyBytes), "AES-GCM", false, ["decrypt"]);
    const plain = await subtle.decrypt(
        { name: "AES-GCM", iv: buf(hexToBytes(ivHex)) },
        key,
        buf(hexToBytes(ciphertextHex)),
    );
    return new Uint8Array(plain);
}

// ── PBKDF2-SHA256 ───────────────────────────────────────────────────────────

export async function pbkdf2Derive(password: string, saltHex: string): Promise<Uint8Array> {
    const subtle = getSubtle();
    const km = await subtle.importKey("raw", buf(enc.encode(password)), "PBKDF2", false, ["deriveKey"]);
    const key = await subtle.deriveKey(
        { name: "PBKDF2", hash: "SHA-256", salt: buf(hexToBytes(saltHex)), iterations: 250_000 },
        km,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
    );
    return new Uint8Array(await subtle.exportKey("raw", key));
}

// ── Random ──────────────────────────────────────────────────────────────────

export { getRandomBytes };
