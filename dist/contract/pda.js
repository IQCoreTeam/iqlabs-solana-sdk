"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerAccountPda = exports.getUserInventoryPda = exports.getCodeAccountPda = exports.getSessionPda = exports.getUserPda = exports.getTargetConnectionTableRefPda = exports.getTargetTableRefPda = exports.getConnectionTableRefPda = exports.getConnectionInstructionTablePda = exports.getConnectionTablePda = exports.getInstructionTablePda = exports.getTablePda = exports.getDbRootPda = void 0;
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("./constants");
const profile_1 = require("./profile");
const SEED_CONFIG_BYTES = Buffer.from(constants_1.SEED_CONFIG);
const SEED_DB_ROOT_BYTES = Buffer.from(constants_1.SEED_DB_ROOT);
const SEED_TABLE_BYTES = Buffer.from(constants_1.SEED_TABLE);
const SEED_TABLE_REF_BYTES = Buffer.from(constants_1.SEED_TABLE_REF);
const SEED_INSTRUCTION_BYTES = Buffer.from(constants_1.SEED_INSTRUCTION);
const SEED_TARGET_BYTES = Buffer.from(constants_1.SEED_TARGET);
const SEED_USER_BYTES = Buffer.from(constants_1.SEED_USER);
const SEED_BUNDLE_BYTES = Buffer.from(constants_1.SEED_BUNDLE);
const SEED_CONNECTION_BYTES = Buffer.from(constants_1.SEED_CONNECTION);
const SEED_CODE_ACCOUNT_BYTES = Buffer.from(constants_1.SEED_CODE_ACCOUNT);
const SEED_USER_INVENTORY_BYTES = Buffer.from(constants_1.SEED_USER_INVENTORY);
const encodeBytesSeed = (value) => Buffer.from(value);
const encodeU64Seed = (value) => {
    const data = Buffer.alloc(8);
    const numberValue = typeof value === "bigint" ? value : BigInt(value);
    data.writeBigUInt64LE(numberValue, 0);
    return data;
};
const findPda = (seeds, programId) => web3_js_1.PublicKey.findProgramAddressSync(seeds, programId)[0];
const getProgramIdSeed = (programId) => programId.toBuffer();
const getDbRootPda = (dbRootId, programId = (0, profile_1.getProgramId)()) => findPda([
    SEED_DB_ROOT_BYTES,
    getProgramIdSeed(programId),
    encodeBytesSeed(dbRootId),
], programId);
exports.getDbRootPda = getDbRootPda;
const getTablePda = (dbRoot, tableSeed, programId = (0, profile_1.getProgramId)()) => findPda([
    SEED_TABLE_BYTES,
    getProgramIdSeed(programId),
    dbRoot.toBuffer(),
    encodeBytesSeed(tableSeed),
], programId);
exports.getTablePda = getTablePda;
const getInstructionTablePda = (dbRoot, tableSeed, programId = (0, profile_1.getProgramId)()) => findPda([
    SEED_TABLE_BYTES,
    getProgramIdSeed(programId),
    dbRoot.toBuffer(),
    encodeBytesSeed(tableSeed),
    SEED_INSTRUCTION_BYTES,
], programId);
exports.getInstructionTablePda = getInstructionTablePda;
const getConnectionTablePda = (dbRoot, connectionSeed, programId = (0, profile_1.getProgramId)()) => findPda([
    SEED_CONNECTION_BYTES,
    getProgramIdSeed(programId),
    dbRoot.toBuffer(),
    encodeBytesSeed(connectionSeed),
], programId);
exports.getConnectionTablePda = getConnectionTablePda;
const getConnectionInstructionTablePda = (dbRoot, connectionSeed, programId = (0, profile_1.getProgramId)()) => findPda([
    SEED_CONNECTION_BYTES,
    getProgramIdSeed(programId),
    dbRoot.toBuffer(),
    encodeBytesSeed(connectionSeed),
    SEED_INSTRUCTION_BYTES,
], programId);
exports.getConnectionInstructionTablePda = getConnectionInstructionTablePda;
const getConnectionTableRefPda = (dbRoot, connectionSeed, programId = (0, profile_1.getProgramId)()) => findPda([
    SEED_TABLE_REF_BYTES,
    getProgramIdSeed(programId),
    dbRoot.toBuffer(),
    encodeBytesSeed(connectionSeed),
], programId);
exports.getConnectionTableRefPda = getConnectionTableRefPda;
const getTargetTableRefPda = (dbRoot, tableSeed, programId = (0, profile_1.getProgramId)()) => findPda([
    SEED_TABLE_REF_BYTES,
    getProgramIdSeed(programId),
    dbRoot.toBuffer(),
    encodeBytesSeed(tableSeed),
    SEED_TARGET_BYTES,
], programId);
exports.getTargetTableRefPda = getTargetTableRefPda;
const getTargetConnectionTableRefPda = (dbRoot, connectionSeed, programId = (0, profile_1.getProgramId)()) => findPda([
    SEED_TABLE_REF_BYTES,
    getProgramIdSeed(programId),
    dbRoot.toBuffer(),
    encodeBytesSeed(connectionSeed),
    SEED_TARGET_BYTES,
], programId);
exports.getTargetConnectionTableRefPda = getTargetConnectionTableRefPda;
const getUserPda = (user, programId = (0, profile_1.getProgramId)()) => findPda([
    SEED_USER_BYTES,
    getProgramIdSeed(programId),
    user.toBuffer(),
], programId);
exports.getUserPda = getUserPda;
const getSessionPda = (user, seq, programId = (0, profile_1.getProgramId)()) => findPda([
    SEED_BUNDLE_BYTES,
    getProgramIdSeed(programId),
    user.toBuffer(),
    encodeU64Seed(seq),
], programId);
exports.getSessionPda = getSessionPda;
const getCodeAccountPda = (user, programId = (0, profile_1.getProgramId)()) => findPda([SEED_CODE_ACCOUNT_BYTES, user.toBuffer()], programId);
exports.getCodeAccountPda = getCodeAccountPda;
const getUserInventoryPda = (user, programId = (0, profile_1.getProgramId)()) => findPda([SEED_USER_INVENTORY_BYTES, user.toBuffer()], programId);
exports.getUserInventoryPda = getUserInventoryPda;
const getServerAccountPda = (user, serverId, programId = (0, profile_1.getProgramId)()) => findPda([Buffer.from(serverId), user.toBuffer()], programId);
exports.getServerAccountPda = getServerAccountPda;
