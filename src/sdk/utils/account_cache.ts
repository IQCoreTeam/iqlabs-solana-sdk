import {Connection, PublicKey} from "@solana/web3.js";

const ACCOUNT_CACHE_TTL_MS = 120_000;

type CacheEntry = {
    exists: boolean;
    expiresAt: number;
};

const accountExistsCache = new Map<string, CacheEntry>();

const getCacheKey = (pubkey: PublicKey) => pubkey.toBase58();

const readCache = (key: string) => {
    const entry = accountExistsCache.get(key);
    if (!entry) {
        return null;
    }
    if (Date.now() > entry.expiresAt) {
        accountExistsCache.delete(key);
        return null;
    }
    return entry.exists;
};

const writeCache = (key: string, exists: boolean) => {
    accountExistsCache.set(key, {
        exists,
        expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS,
    });
};

export async function getCachedAccountExists(
    connection: Connection,
    pubkey: PublicKey,
) {
    const key = getCacheKey(pubkey);
    const cached = readCache(key);
    if (cached !== null) {
        return cached;
    }
    const info = await connection.getAccountInfo(pubkey);
    const exists = Boolean(info);
    writeCache(key, exists);
    return exists;
}

export async function refreshAccountExists(
    connection: Connection,
    pubkey: PublicKey,
) {
    const key = getCacheKey(pubkey);
    const info = await connection.getAccountInfo(pubkey);
    const exists = Boolean(info);
    writeCache(key, exists);
    return exists;
}

export function markAccountExists(pubkey: PublicKey, exists = true) {
    writeCache(getCacheKey(pubkey), exists);
}
