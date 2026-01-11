import {PublicKey} from "@solana/web3.js";

import {
    SEED_BUNDLE,
    SEED_CODE_ACCOUNT,
    SEED_CONFIG,
    SEED_CONNECTION,
    SEED_USER_INVENTORY,
    SEED_DB_ROOT,
    SEED_INSTRUCTION,
    SEED_TABLE,
    SEED_TABLE_REF,
    SEED_TARGET,
    SEED_USER,
} from "./constants";
import {getProgramId} from "./profile";

type Bytes = Uint8Array<any>;

const SEED_CONFIG_BYTES = Buffer.from(SEED_CONFIG);
const SEED_DB_ROOT_BYTES = Buffer.from(SEED_DB_ROOT);
const SEED_TABLE_BYTES = Buffer.from(SEED_TABLE);
const SEED_TABLE_REF_BYTES = Buffer.from(SEED_TABLE_REF);
const SEED_INSTRUCTION_BYTES = Buffer.from(SEED_INSTRUCTION);
const SEED_TARGET_BYTES = Buffer.from(SEED_TARGET);
const SEED_USER_BYTES = Buffer.from(SEED_USER);
const SEED_BUNDLE_BYTES = Buffer.from(SEED_BUNDLE);
const SEED_CONNECTION_BYTES = Buffer.from(SEED_CONNECTION);
const SEED_CODE_ACCOUNT_BYTES = Buffer.from(SEED_CODE_ACCOUNT);
const SEED_USER_INVENTORY_BYTES = Buffer.from(SEED_USER_INVENTORY);

const encodeBytesSeed = (value: Bytes) => Buffer.from(value);

const encodeU64Seed = (value: bigint | number) => {
    const data = Buffer.alloc(8);
    const numberValue = typeof value === "bigint" ? value : BigInt(value);
    data.writeBigUInt64LE(numberValue, 0);
    return data;
};

const findPda = (
    seeds: Array<Buffer | Uint8Array<any>>,
    programId: PublicKey,
) => PublicKey.findProgramAddressSync(seeds, programId)[0];

const getProgramIdSeed = (programId: PublicKey): Buffer =>
    programId.toBuffer() as Buffer;

export const getDbRootPda = (
    dbRootId: Bytes,
    programId: PublicKey = getProgramId(),
) =>
    findPda([
        SEED_DB_ROOT_BYTES,
        getProgramIdSeed(programId),
        encodeBytesSeed(dbRootId),
    ], programId);

export const getTablePda = (
    dbRoot: PublicKey,
    tableSeed: Bytes,
    programId: PublicKey = getProgramId(),
) =>
    findPda([
        SEED_TABLE_BYTES,
        getProgramIdSeed(programId),
        dbRoot.toBuffer(),
        encodeBytesSeed(tableSeed),
    ], programId);

export const getInstructionTablePda = (
    dbRoot: PublicKey,
    tableSeed: Bytes,
    programId: PublicKey = getProgramId(),
) =>
    findPda([
        SEED_TABLE_BYTES,
        getProgramIdSeed(programId),
        dbRoot.toBuffer(),
        encodeBytesSeed(tableSeed),
        SEED_INSTRUCTION_BYTES,
    ], programId);

export const getConnectionTablePda = (
    dbRoot: PublicKey,
    connectionSeed: Bytes,
    programId: PublicKey = getProgramId(),
) =>
    findPda([
        SEED_CONNECTION_BYTES,
        getProgramIdSeed(programId),
        dbRoot.toBuffer(),
        encodeBytesSeed(connectionSeed),
    ], programId);

export const getConnectionInstructionTablePda = (
    dbRoot: PublicKey,
    connectionSeed: Bytes,
    programId: PublicKey = getProgramId(),
) =>
    findPda([
        SEED_CONNECTION_BYTES,
        getProgramIdSeed(programId),
        dbRoot.toBuffer(),
        encodeBytesSeed(connectionSeed),
        SEED_INSTRUCTION_BYTES,
    ], programId);

export const getConnectionTableRefPda = (
    dbRoot: PublicKey,
    connectionSeed: Bytes,
    programId: PublicKey = getProgramId(),
) =>
    findPda([
        SEED_TABLE_REF_BYTES,
        getProgramIdSeed(programId),
        dbRoot.toBuffer(),
        encodeBytesSeed(connectionSeed),
    ], programId);

export const getTargetTableRefPda = (
    dbRoot: PublicKey,
    tableSeed: Bytes,
    programId: PublicKey = getProgramId(),
) =>
    findPda([
        SEED_TABLE_REF_BYTES,
        getProgramIdSeed(programId),
        dbRoot.toBuffer(),
        encodeBytesSeed(tableSeed),
        SEED_TARGET_BYTES,
    ], programId);

export const getTargetConnectionTableRefPda = (
    dbRoot: PublicKey,
    connectionSeed: Bytes,
    programId: PublicKey = getProgramId(),
) =>
    findPda([
        SEED_TABLE_REF_BYTES,
        getProgramIdSeed(programId),
        dbRoot.toBuffer(),
        encodeBytesSeed(connectionSeed),
        SEED_TARGET_BYTES,
    ], programId);

export const getUserPda = (
    user: PublicKey,
    programId: PublicKey = getProgramId(),
) =>
    findPda([
        SEED_USER_BYTES,
        getProgramIdSeed(programId),
        user.toBuffer(),
    ], programId);

export const getSessionPda = (
    user: PublicKey,
    seq: bigint | number,
    programId: PublicKey = getProgramId(),
) =>
    findPda([
        SEED_BUNDLE_BYTES,
        getProgramIdSeed(programId),
        user.toBuffer(),
        encodeU64Seed(seq),
    ], programId);

export const getCodeAccountPda = (
    user: PublicKey,
    programId: PublicKey = getProgramId(),
) =>
    findPda([SEED_CODE_ACCOUNT_BYTES, user.toBuffer()], programId);

export const getUserInventoryPda = (
    user: PublicKey,
    programId: PublicKey = getProgramId(),
) =>
    findPda([SEED_USER_INVENTORY_BYTES, user.toBuffer()], programId);

export const getServerAccountPda = (
    user: PublicKey,
    serverId: string,
    programId: PublicKey = getProgramId(),
) =>
    findPda([Buffer.from(serverId), user.toBuffer()], programId);
