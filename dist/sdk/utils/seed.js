"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveSeedBytes = deriveSeedBytes;
exports.sortPubkeys = sortPubkeys;
exports.deriveDmSeed = deriveDmSeed;
exports.toSeedBytes = toSeedBytes;
const sha3_1 = require("@noble/hashes/sha3");
const HEX_64 = /^[0-9a-fA-F]{64}$/;
function deriveSeedBytes(value) {
    if (HEX_64.test(value)) {
        return Uint8Array.from(Buffer.from(value, "hex"));
    }
    return (0, sha3_1.keccak_256)(Buffer.from(value, "utf8"));
}
function sortPubkeys(userA, userB) {
    return userA < userB ? [userA, userB] : [userB, userA];
}
function deriveDmSeed(userA, userB) {
    const [sortedA, sortedB] = sortPubkeys(userA, userB);
    return deriveSeedBytes(`${sortedA}:${sortedB}`);
}
function toSeedBytes(value) {
    return typeof value === "string" ? deriveSeedBytes(value) : value;
}
