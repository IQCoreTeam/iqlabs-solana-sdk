import {Connection, Transaction, TransactionInstruction, type PublicKey, PACKET_DATA_SIZE} from "@solana/web3.js";
import {userInitializeInstruction, type InstructionBuilder} from "../../contract";
import {toWalletSigner, type SignerInput} from "../utils/wallet";

export class TransactionTooLargeError extends Error {
    constructor(size: number) {
        super(`Transaction too large for inline: ${size} > ${PACKET_DATA_SIZE}`);
        this.name = "TransactionTooLargeError";
    }
}

const ACCOUNT_CACHE_TTL_MS = 120_000;

const accountExistsCache = new Map<string, { exists: boolean; expiresAt: number }>();

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

const markAccountExists = (pubkey: PublicKey, exists = true) => {
    writeCache(getCacheKey(pubkey), exists);
};

const MAGIC_SIGNATURES = [
    {ext: "png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]},
    {ext: "jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff]},
    {ext: "gif", mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38]},
    {ext: "pdf", mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d]},
    {ext: "zip", mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04]},
];

const looksBase64 = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(trimmed);
};

const toBytes = (value: string) => {
    if (looksBase64(value)) {
        const decoded = Buffer.from(value, "base64");
        if (decoded.length > 0) {
            return decoded;
        }
    }
    return Buffer.from(value, "utf8");
};

const startsWith = (data: Uint8Array, bytes: number[]) => {
    if (data.length < bytes.length) {
        return false;
    }
    for (let i = 0; i < bytes.length; i += 1) {
        if (data[i] !== bytes[i]) {
            return false;
        }
    }
    return true;
};

const isWebp = (data: Uint8Array) => {
    if (data.length < 12) {
        return false;
    }
    return (
        data[0] === 0x52 &&
        data[1] === 0x49 &&
        data[2] === 0x46 &&
        data[3] === 0x46 &&
        data[8] === 0x57 &&
        data[9] === 0x45 &&
        data[10] === 0x42 &&
        data[11] === 0x50
    );
};

const isMp4 = (data: Uint8Array) => {
    if (data.length < 12) {
        return false;
    }
    return data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70;
};

export function readMagicBytes(chunk: string) {
    const data = toBytes(chunk);
    for (const sig of MAGIC_SIGNATURES) {
        if (startsWith(data, sig.bytes)) {
            return {ext: sig.ext, mime: sig.mime};
        }
    }
    if (isWebp(data)) {
        return {ext: "webp", mime: "image/webp"};
    }
    if (isMp4(data)) {
        return {ext: "mp4", mime: "video/mp4"};
    }
    return {ext: "bin", mime: "application/octet-stream"};
}

export async function sendTx(
    connection: Connection,
    signer: SignerInput,
    instructions: TransactionInstruction | TransactionInstruction[],
) {
    const wallet = toWalletSigner(signer);
    const tx = new Transaction();
    if (Array.isArray(instructions)) {
        tx.add(...instructions);
    } else {
        tx.add(instructions);
    }

    const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    const signed = await wallet.signTransaction(tx);
    const serialized = signed.serialize();
    if (serialized.length > PACKET_DATA_SIZE) {
        throw new TransactionTooLargeError(serialized.length);
    }
    const signature = await connection.sendRawTransaction(serialized);
    await connection.confirmTransaction({signature, blockhash, lastValidBlockHeight});

    return signature;
}

export async function sendWithRetry(
    connection: Connection,
    signer: SignerInput,
    buildIx: (forceChunked: boolean) => Promise<TransactionInstruction | TransactionInstruction[]>,
): Promise<string> {
    try {
        return await sendTx(connection, signer, await buildIx(false));
    } catch (e) {
        if (e instanceof TransactionTooLargeError) {
            return sendTx(connection, signer, await buildIx(true));
        }
        throw e;
    }
}

export async function ensureUserInitialized(
    connection: Connection,
    signer: SignerInput,
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        code_account: PublicKey;
        user_state: PublicKey;
        user_inventory: PublicKey;
        system_program?: PublicKey;
    },
) {
    let exists = await getCachedAccountExists(connection, accounts.user_inventory);
    if (!exists) {
        exists = await refreshAccountExists(connection, accounts.user_inventory);
    }
    if (exists) {
        return;
    }
    const ix = userInitializeInstruction(builder, accounts);
    await sendTx(connection, signer, ix);
    markAccountExists(accounts.user_inventory, true);
}
