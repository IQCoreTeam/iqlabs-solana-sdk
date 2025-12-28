import { keccak_256 } from "@noble/hashes/sha3";

const HEX_64 = /^[0-9a-fA-F]{64}$/;

export function deriveSeedBytes(value: string): Uint8Array {
  if (HEX_64.test(value)) {
    return Uint8Array.from(Buffer.from(value, "hex"));
  }
  return keccak_256(Buffer.from(value, "utf8"));
}

export function sortPubkeys(userA: string, userB: string): [string, string] {
  return userA < userB ? [userA, userB] : [userB, userA];
}

export function deriveDmSeed(userA: string, userB: string): Uint8Array {
  const [sortedA, sortedB] = sortPubkeys(userA, userB);
  return deriveSeedBytes(`${sortedA}:${sortedB}`);
}
