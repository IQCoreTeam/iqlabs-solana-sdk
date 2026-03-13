import {keccak_256} from "@noble/hashes/sha3";

const HEX_64 = /^[0-9a-fA-F]{64}$/;

export function deriveSeedBytes(value: string): Uint8Array {
    if (HEX_64.test(value)) {
        return Uint8Array.from(Buffer.from(value, "hex"));
    }
    return keccak_256(Buffer.from(value, "utf8"));
}

export function deriveDmSeed(userA: string, userB: string): Uint8Array {
    const [sortedA, sortedB] = userA < userB ? [userA, userB] : [userB, userA];
    return deriveSeedBytes(`${sortedA}:${sortedB}`);
}

export function toSeedBytes(value: Uint8Array | string): Uint8Array {
    return typeof value === "string" ? deriveSeedBytes(value) : value;
}
