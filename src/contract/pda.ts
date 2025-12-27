import {
  addEncoderSizePrefix,
  getAddressEncoder,
  getBytesEncoder,
  getProgramDerivedAddress,
  getU32Encoder,
  getU64Encoder,
  getUtf8Encoder,
  type Address,
  type ProgramDerivedAddress,
  type ReadonlyUint8Array,
} from "@solana/kit";
import type { ProgramProfile } from "./profile";

const bytesEncoder = getBytesEncoder();
const bytesWithU32 = addEncoderSizePrefix(getBytesEncoder(), getU32Encoder());
const addressEncoder = getAddressEncoder();
const u64Encoder = getU64Encoder();
const utf8Encoder = getUtf8Encoder();

const SEED_CONFIG = new Uint8Array([99, 111, 110, 102, 105, 103]);
const SEED_DB_ROOT = new Uint8Array([105, 113, 100, 98, 45, 114, 111, 111, 116]);
const SEED_DB_ROOT_SALT = new Uint8Array([
  211, 224, 187, 191, 8, 213, 226, 2, 227, 246, 232, 81, 212, 209, 72, 205,
  134, 90, 5, 53, 82, 224, 210, 56, 59, 10, 7, 236, 44, 102, 122, 211,
]);
const SEED_USER = new Uint8Array([117, 115, 101, 114]);
const SEED_BUNDLE = new Uint8Array([98, 117, 110, 100, 108, 101]);
const SEED_CODE_ACCOUNT = new Uint8Array([
  109, 89, 125, 57, 79, 86, 53, 106, 65, 71, 66, 74, 105, 113, 54, 57,
  48, 48,
]);
const SEED_DB_ACCOUNT = new Uint8Array([
  100, 98, 109, 89, 125, 57, 79, 86, 53, 106, 65, 71, 66, 74, 105, 113,
  54, 57, 48, 48,
]);

const encodeBytes = (value: Uint8Array) => bytesEncoder.encode(value);

export async function derivePda(
  profile: ProgramProfile,
  seeds: ReadonlyUint8Array[],
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({ programAddress: profile.programId, seeds });
}

export async function getConfigPda(
  profile: ProgramProfile,
): Promise<ProgramDerivedAddress> {
  return derivePda(profile, [encodeBytes(SEED_CONFIG)]);
}

export async function getDbRootPda(
  profile: ProgramProfile,
  dbRootId: ReadonlyUint8Array,
): Promise<ProgramDerivedAddress> {
  return derivePda(profile, [
    encodeBytes(SEED_DB_ROOT),
    encodeBytes(SEED_DB_ROOT_SALT),
    bytesWithU32.encode(dbRootId),
  ]);
}

export async function getUserStatePda(
  profile: ProgramProfile,
  user: Address,
): Promise<ProgramDerivedAddress> {
  return derivePda(profile, [
    encodeBytes(SEED_USER),
    encodeBytes(SEED_DB_ROOT_SALT),
    addressEncoder.encode(user),
  ]);
}

export async function getSessionPda(
  profile: ProgramProfile,
  user: Address,
  seq: number | bigint,
): Promise<ProgramDerivedAddress> {
  const seqValue = typeof seq === "bigint" ? seq : BigInt(seq);
  return derivePda(profile, [
    encodeBytes(SEED_BUNDLE),
    encodeBytes(SEED_DB_ROOT_SALT),
    addressEncoder.encode(user),
    u64Encoder.encode(seqValue),
  ]);
}

export async function getCodeAccountPda(
  profile: ProgramProfile,
  user: Address,
): Promise<ProgramDerivedAddress> {
  return derivePda(profile, [
    encodeBytes(SEED_CODE_ACCOUNT),
    addressEncoder.encode(user),
  ]);
}

export async function getDbAccountPda(
  profile: ProgramProfile,
  user: Address,
): Promise<ProgramDerivedAddress> {
  return derivePda(profile, [
    encodeBytes(SEED_DB_ACCOUNT),
    addressEncoder.encode(user),
  ]);
}

export async function getServerAccountPda(
  profile: ProgramProfile,
  serverId: string,
  user: Address,
): Promise<ProgramDerivedAddress> {
  return derivePda(profile, [
    utf8Encoder.encode(serverId),
    addressEncoder.encode(user),
  ]);
}
