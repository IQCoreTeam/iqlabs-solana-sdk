/** Convert hex string to Uint8Array */
export function hexToBytes(hex: string): Uint8Array {
    const len = hex.length >> 1;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}

/** Convert Uint8Array to hex string */
export function bytesToHex(buf: Uint8Array): string {
    return Array.from(buf)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
