import {keccak_256} from "@noble/hashes/sha3";

const HEX_64 = /^[0-9a-fA-F]{64}$/;

export function deriveSeedBytes(value: string): Buffer {
    if (HEX_64.test(value)) {
        return Buffer.from(value, "hex");
    }
    return Buffer.from(keccak_256(Buffer.from(value, "utf8")));
}

export function deriveDmSeed(userA: string, userB: string): Buffer {
    const [sortedA, sortedB] = userA < userB ? [userA, userB] : [userB, userA];
    return deriveSeedBytes(`${sortedA}:${sortedB}`);
}

export function toSeedBytes(value: Uint8Array | string): Buffer {
    if (typeof value === "string") return deriveSeedBytes(value);
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
}
