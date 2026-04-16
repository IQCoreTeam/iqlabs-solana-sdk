"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveSeedBytes = deriveSeedBytes;
exports.deriveDmSeed = deriveDmSeed;
exports.toSeedBytes = toSeedBytes;
const sha3_1 = require("@noble/hashes/sha3");
const HEX_64 = /^[0-9a-fA-F]{64}$/;
function deriveSeedBytes(value) {
    if (HEX_64.test(value)) {
        return Buffer.from(value, "hex");
    }
    return Buffer.from((0, sha3_1.keccak_256)(Buffer.from(value, "utf8")));
}
function deriveDmSeed(userA, userB) {
    const [sortedA, sortedB] = userA < userB ? [userA, userB] : [userB, userA];
    return deriveSeedBytes(`${sortedA}:${sortedB}`);
}
function toSeedBytes(value) {
    if (typeof value === "string")
        return deriveSeedBytes(value);
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
}
