import { PublicKey } from "@solana/web3.js";
import type { ProgramProfile } from "./profile";
import {
  SEED_BUNDLE,
  SEED_CODE_ACCOUNT,
  SEED_CONFIG,
  SEED_CONNECTION,
  SEED_DB_ACCOUNT,
  SEED_DB_ROOT,
  SEED_DB_ROOT_SALT,
  SEED_INSTRUCTION,
  SEED_TABLE,
  SEED_TABLE_REF,
  SEED_TARGET,
  SEED_USER,
} from "./constants";

type Bytes = Uint8Array;

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
const SEED_DB_ACCOUNT_BYTES = Buffer.from(SEED_DB_ACCOUNT);
const SEED_DB_ROOT_SALT_BYTES = Buffer.from(SEED_DB_ROOT_SALT);

const encodeBytesSeed = (value: Bytes) => Buffer.from(value);

const encodeU64Seed = (value: bigint | number) => {
  const data = Buffer.alloc(8);
  const numberValue = typeof value === "bigint" ? value : BigInt(value);
  data.writeBigUInt64LE(numberValue, 0);
  return data;
};

const findPda = (profile: ProgramProfile, seeds: Buffer[]) =>
  PublicKey.findProgramAddressSync(seeds, profile.programId)[0];

const resolveProgramSeed = (profile: ProgramProfile) =>
  profile.runtime === "pinocchio"
    ? profile.programId.toBuffer()
    : SEED_DB_ROOT_SALT_BYTES;

export const getConfigPda = (profile: ProgramProfile) =>
  findPda(profile, [SEED_CONFIG_BYTES]);

export const getDbRootPda = (profile: ProgramProfile, dbRootId: Bytes) =>
  findPda(profile, [
    SEED_DB_ROOT_BYTES,
    resolveProgramSeed(profile),
    encodeBytesSeed(dbRootId),
  ]);

export const getTablePda = (
  profile: ProgramProfile,
  dbRoot: PublicKey,
  tableSeed: Bytes,
) =>
  findPda(profile, [
    SEED_TABLE_BYTES,
    resolveProgramSeed(profile),
    dbRoot.toBuffer(),
    encodeBytesSeed(tableSeed),
  ]);

export const getInstructionTablePda = (
  profile: ProgramProfile,
  dbRoot: PublicKey,
  tableSeed: Bytes,
) =>
  findPda(profile, [
    SEED_TABLE_BYTES,
    resolveProgramSeed(profile),
    dbRoot.toBuffer(),
    encodeBytesSeed(tableSeed),
    SEED_INSTRUCTION_BYTES,
  ]);

export const getConnectionTablePda = (
  profile: ProgramProfile,
  dbRoot: PublicKey,
  connectionSeed: Bytes,
) =>
  findPda(profile, [
    SEED_CONNECTION_BYTES,
    resolveProgramSeed(profile),
    dbRoot.toBuffer(),
    encodeBytesSeed(connectionSeed),
  ]);

export const getConnectionInstructionTablePda = (
  profile: ProgramProfile,
  dbRoot: PublicKey,
  connectionSeed: Bytes,
) =>
  findPda(profile, [
    SEED_CONNECTION_BYTES,
    resolveProgramSeed(profile),
    dbRoot.toBuffer(),
    encodeBytesSeed(connectionSeed),
    SEED_INSTRUCTION_BYTES,
  ]);

export const getTableRefPda = (
  profile: ProgramProfile,
  dbRoot: PublicKey,
  tableSeed: Bytes,
) =>
  findPda(profile, [
    SEED_TABLE_REF_BYTES,
    resolveProgramSeed(profile),
    dbRoot.toBuffer(),
    encodeBytesSeed(tableSeed),
  ]);

export const getConnectionTableRefPda = (
  profile: ProgramProfile,
  dbRoot: PublicKey,
  connectionSeed: Bytes,
) =>
  findPda(profile, [
    SEED_TABLE_REF_BYTES,
    resolveProgramSeed(profile),
    dbRoot.toBuffer(),
    encodeBytesSeed(connectionSeed),
  ]);

export const getTargetTableRefPda = (
  profile: ProgramProfile,
  dbRoot: PublicKey,
  tableSeed: Bytes,
) =>
  findPda(profile, [
    SEED_TABLE_REF_BYTES,
    resolveProgramSeed(profile),
    dbRoot.toBuffer(),
    encodeBytesSeed(tableSeed),
    SEED_TARGET_BYTES,
  ]);

export const getTargetConnectionTableRefPda = (
  profile: ProgramProfile,
  dbRoot: PublicKey,
  connectionSeed: Bytes,
) =>
  findPda(profile, [
    SEED_TABLE_REF_BYTES,
    resolveProgramSeed(profile),
    dbRoot.toBuffer(),
    encodeBytesSeed(connectionSeed),
    SEED_TARGET_BYTES,
  ]);

export const getUserPda = (profile: ProgramProfile, user: PublicKey) =>
  findPda(profile, [
    SEED_USER_BYTES,
    resolveProgramSeed(profile),
    user.toBuffer(),
  ]);

export const getSessionPda = (
  profile: ProgramProfile,
  user: PublicKey,
  seq: bigint | number,
) =>
  findPda(profile, [
    SEED_BUNDLE_BYTES,
    resolveProgramSeed(profile),
    user.toBuffer(),
    encodeU64Seed(seq),
  ]);

export const getCodeAccountPda = (profile: ProgramProfile, user: PublicKey) =>
  findPda(profile, [SEED_CODE_ACCOUNT_BYTES, user.toBuffer()]);

export const getDbAccountPda = (profile: ProgramProfile, user: PublicKey) =>
  findPda(profile, [SEED_DB_ACCOUNT_BYTES, user.toBuffer()]);

export const getServerAccountPda = (
  profile: ProgramProfile,
  user: PublicKey,
  serverId: string,
) => findPda(profile, [Buffer.from(serverId), user.toBuffer()]);
