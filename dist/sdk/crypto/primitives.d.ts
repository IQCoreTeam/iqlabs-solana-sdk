/** Low-level crypto primitives (Web Crypto API). Browser + Node 18+. */
export declare function getRandomBytes(n: number): Uint8Array;
export declare function hkdfDerive(ikm: Uint8Array, salt: string, info: string): Promise<Uint8Array>;
export declare function aesEncrypt(keyBytes: Uint8Array, plaintext: Uint8Array): Promise<{
    iv: string;
    ciphertext: string;
}>;
export declare function aesDecrypt(keyBytes: Uint8Array, ivHex: string, ciphertextHex: string): Promise<Uint8Array>;
export declare function pbkdf2Derive(password: string, saltHex: string): Promise<Uint8Array>;
