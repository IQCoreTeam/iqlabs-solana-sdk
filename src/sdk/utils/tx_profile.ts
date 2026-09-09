import {Connection, PublicKey} from "@solana/web3.js";
import {
    CHUNK_SIZE,
    CHUNK_SIZE_V1,
    DIRECT_METADATA_MAX_BYTES,
    DIRECT_METADATA_MAX_BYTES_V1,
    DEFAULT_LINKED_LIST_THRESHOLD,
    TX_V1_FEATURE_GATE,
    FEATURE_PROGRAM_ID,
} from "../constants";
import type {SignerInput} from "./wallet";

export type TxProfileVersion = "legacy" | "v1";

export type TxProfile = {
    version: TxProfileVersion;
    chunkSize: number;
    inlineMaxBytes: number;
    linkedListThreshold: number;
};

export const LEGACY_TX_PROFILE: TxProfile = {
    version: "legacy",
    chunkSize: CHUNK_SIZE,
    inlineMaxBytes: DIRECT_METADATA_MAX_BYTES,
    linkedListThreshold: DEFAULT_LINKED_LIST_THRESHOLD,
};

export const V1_TX_PROFILE: TxProfile = {
    version: "v1",
    chunkSize: CHUNK_SIZE_V1,
    inlineMaxBytes: DIRECT_METADATA_MAX_BYTES_V1,
    linkedListThreshold: DEFAULT_LINKED_LIST_THRESHOLD,
};

/**
 * The v1 send path serializes and signs the message manually, which needs the
 * raw secret key. Wallet signers (MWA, Phantom) only expose signTransaction on
 * web3.js 1.x objects that cannot represent a v1 message, so they stay on the
 * legacy profile until the wallet stack supports v1 natively.
 */
export const canSignV1 = (signer: SignerInput) =>
    signer instanceof Object && "secretKey" in signer;

const INACTIVE_RECHECK_MS = 10 * 60 * 1000;

// Keyed by RPC endpoint. Activation is one-way, so a positive result is
// cached forever; a negative one is rechecked on a TTL.
const gateCache = new Map<string, {active: boolean; expiresAt: number}>();

export async function isTxV1Active(connection: Connection) {
    const key = connection.rpcEndpoint;
    const cached = gateCache.get(key);
    if (cached && (cached.active || Date.now() < cached.expiresAt)) {
        return cached.active;
    }
    let active = false;
    try {
        const info = await connection.getAccountInfo(new PublicKey(TX_V1_FEATURE_GATE));
        active =
            info !== null &&
            info.owner.toBase58() === FEATURE_PROGRAM_ID &&
            info.data.length > 0 &&
            info.data[0] === 1; // Option<u64> tag: Some(activation_slot)
    } catch {
        active = false; // treat RPC failures as inactive; rechecked on TTL
    }
    gateCache.set(key, {active, expiresAt: Date.now() + INACTIVE_RECHECK_MS});
    return active;
}

/**
 * Pick the write profile for this connection + signer.
 * Override with IQ_TX_PROFILE=legacy|v1 (v1 still requires a keypair signer).
 */
export async function resolveTxProfile(
    connection: Connection,
    signer: SignerInput,
): Promise<TxProfile> {
    const override = typeof process !== "undefined" ? process.env?.IQ_TX_PROFILE : undefined;
    if (override === "legacy") return LEGACY_TX_PROFILE;
    if (!canSignV1(signer)) return LEGACY_TX_PROFILE;
    if (override === "v1") return V1_TX_PROFILE;
    return (await isTxV1Active(connection)) ? V1_TX_PROFILE : LEGACY_TX_PROFILE;
}

/** Whether a tx for this connection + signer should go out as v1. */
export const shouldSendV1 = async (connection: Connection, signer: SignerInput) =>
    (await resolveTxProfile(connection, signer)).version === "v1";
