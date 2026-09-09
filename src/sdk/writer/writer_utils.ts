import {BN} from "@coral-xyz/anchor";
import {Connection, Transaction, TransactionInstruction, type PublicKey} from "@solana/web3.js";
import {reallocAccountInstruction, userInitializeInstruction, type InstructionBuilder} from "../../contract";
import {CODE_ACCOUNT_SPACE, USER_INVENTORY_SPACE} from "../constants";
import {resolveTxProfile, shouldSendV1} from "../utils/tx_profile";
import {toWalletSigner, type SignerInput} from "../utils/wallet";
import {sendTxV1} from "./v1_tx";
import type {Signer} from "@solana/web3.js";

const ACCOUNT_CACHE_TTL_MS = 120_000;

type AccountState = {exists: boolean; dataLen: number};

const accountStateCache = new Map<string, AccountState & {expiresAt: number}>();

const getCacheKey = (pubkey: PublicKey) => pubkey.toBase58();

const readCache = (key: string): AccountState | null => {
    const entry = accountStateCache.get(key);
    if (!entry) {
        return null;
    }
    if (Date.now() > entry.expiresAt) {
        accountStateCache.delete(key);
        return null;
    }
    return {exists: entry.exists, dataLen: entry.dataLen};
};

const writeCache = (key: string, state: AccountState) => {
    accountStateCache.set(key, {
        ...state,
        expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS,
    });
};

const toState = (info: {data: {length: number}} | null): AccountState => ({
    exists: Boolean(info),
    dataLen: info ? info.data.length : 0,
});

// Both per-user PDAs in one RPC call; the response already carries the data
// (and thus the size), which the realloc check below rides on for free.
const refreshUserAccountsState = async (
    connection: Connection,
    codeAccount: PublicKey,
    userInventory: PublicKey,
) => {
    const [codeInfo, inventoryInfo] = await connection.getMultipleAccountsInfo([
        codeAccount,
        userInventory,
    ]);
    const state = {code: toState(codeInfo), inventory: toState(inventoryInfo)};
    writeCache(getCacheKey(codeAccount), state.code);
    writeCache(getCacheKey(userInventory), state.inventory);
    return state;
};

const getCachedUserAccountsState = async (
    connection: Connection,
    codeAccount: PublicKey,
    userInventory: PublicKey,
) => {
    const code = readCache(getCacheKey(codeAccount));
    const inventory = readCache(getCacheKey(userInventory));
    if (code && inventory) {
        return {code, inventory};
    }
    return refreshUserAccountsState(connection, codeAccount, userInventory);
};

export async function getCachedAccountExists(
    connection: Connection,
    pubkey: PublicKey,
) {
    const key = getCacheKey(pubkey);
    const cached = readCache(key);
    if (cached !== null) {
        return cached.exists;
    }
    const info = await connection.getAccountInfo(pubkey);
    const state = toState(info);
    writeCache(key, state);
    return state.exists;
}

export async function refreshAccountExists(
    connection: Connection,
    pubkey: PublicKey,
) {
    const key = getCacheKey(pubkey);
    const info = await connection.getAccountInfo(pubkey);
    const state = toState(info);
    writeCache(key, state);
    return state.exists;
}

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
    skipConfirmation = false,
) {
    // The v1 decision stays internal: the feature-gate lookup is cached per
    // endpoint, so callers never need to carry a profile around.
    if (await shouldSendV1(connection, signer)) {
        const ixs = Array.isArray(instructions) ? instructions : [instructions];
        return sendTxV1(connection, signer as Signer, ixs, skipConfirmation);
    }
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
    let raw: Buffer;
    try {
        raw = signed.serialize();
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("too large")) {
            throw new Error(
                "Transaction size exceeded. " +
                "If you are passing many remainingAccounts, reduce the number of accounts " +
                "or store data via inscription and pass the txid instead.",
            );
        }
        throw e;
    }
    const signature = await connection.sendRawTransaction(raw);

    if (!skipConfirmation) {
        await connection.confirmTransaction({signature, blockhash, lastValidBlockHeight}, "finalized");
    }

    return signature;
}

export async function sendTxWithRetries(
    connection: Connection,
    signer: SignerInput,
    instructions: TransactionInstruction | TransactionInstruction[],
    skipConfirmation = false,
    maxRetries = 10,
    retryDelayMs = 1500
) {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++){
        try {
            return await sendTx(connection, signer, instructions, skipConfirmation);
        } catch (error: any) {
            lastError = error

            if (attempt === maxRetries) {
                break;
            }

            const delay = retryDelayMs * (attempt + 1);
            console.warn(`[sendTxWithRetry] Attempt ${attempt + 1}/${maxRetries + 1} failed. Retrying in ${delay}ms...`, error?.message)

            await new Promise(r => setTimeout(r, delay));
        }
    }

    console.error(`[sendTxWithRetry] Failed after ${maxRetries + 1} attempts`);
    throw lastError || new Error('Unknown transaction error after retries');
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
    let state = await getCachedUserAccountsState(
        connection,
        accounts.code_account,
        accounts.user_inventory,
    );
    if (!state.inventory.exists) {
        state = await refreshUserAccountsState(
            connection,
            accounts.code_account,
            accounts.user_inventory,
        );
    }

    if (!state.inventory.exists) {
        const ix = userInitializeInstruction(builder, accounts);
        await sendTx(connection, signer, ix);
        // The upgraded program creates full-size accounts; the pre-upgrade one
        // still creates the 900-byte layout, which the realloc pass below
        // catches on this refresh.
        state = await refreshUserAccountsState(
            connection,
            accounts.code_account,
            accounts.user_inventory,
        );
    }

    // Account size doubles as the layout version marker: anything below the
    // v1 sizes is a pre-upgrade account and gets grown (both accounts in one
    // tx, rent paid by the user) before the first v1-profile write. Legacy
    // profile writes fit the old layout, so nothing is grown there.
    const profile = await resolveTxProfile(connection, signer);
    if (profile.version !== "v1") {
        return;
    }
    const reallocs: TransactionInstruction[] = [];
    if (state.code.exists && state.code.dataLen < CODE_ACCOUNT_SPACE) {
        reallocs.push(
            reallocAccountInstruction(
                builder,
                {payer: accounts.user, target: accounts.code_account, system_program: accounts.system_program},
                {new_size: new BN(CODE_ACCOUNT_SPACE)},
            ),
        );
    }
    if (state.inventory.exists && state.inventory.dataLen < USER_INVENTORY_SPACE) {
        reallocs.push(
            reallocAccountInstruction(
                builder,
                {payer: accounts.user, target: accounts.user_inventory, system_program: accounts.system_program},
                {new_size: new BN(USER_INVENTORY_SPACE)},
            ),
        );
    }
    if (reallocs.length === 0) {
        return;
    }
    await sendTx(connection, signer, reallocs);
    await refreshUserAccountsState(connection, accounts.code_account, accounts.user_inventory);
}
