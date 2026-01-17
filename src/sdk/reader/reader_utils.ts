import {
    PublicKey,
    type MessageAccountKeys,
    type MessageCompiledInstruction,
    type VersionedTransactionResponse,
} from "@solana/web3.js";
import {
    getSessionPda,
    getUserPda,
    resolveContractRuntime,
} from "../../contract";
import {DEFAULT_CONTRACT_MODE} from "../../constants";
import {getConnection} from "../utils/connection_helper";
import {createRateLimiter} from "../utils/rate_limiter";
import {resolveSessionSpeed, SESSION_SPEED_PROFILES} from "../utils/session_speed";

import {
    readerContext,
    resolveReaderModeFromTx,
    resolveReaderProgramId,
} from "./reader_context";

const {instructionCoder} = readerContext;
export const decodeReaderInstruction = (
    ix: MessageCompiledInstruction,
    accountKeys: MessageAccountKeys,
): ReturnType<typeof instructionCoder.decode> | null => {
    const programId = accountKeys.get(ix.programIdIndex);
    if (!programId) {
        return null;
    }
    const isAnchor = programId.equals(readerContext.anchorProgramId);
    const isPinocchio = programId.equals(readerContext.pinocchioProgramId);
    if (!isAnchor && !isPinocchio) {
        return null;
    }
    return instructionCoder.decode(Buffer.from(ix.data));
};

// ----- user_inventory_code_in decoding -----
export const decodeUserInventoryCodeIn = (
    tx: VersionedTransactionResponse,
    mode: string = DEFAULT_CONTRACT_MODE,
): { onChainPath: string; metadata: string } => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();
    const userMode = resolveContractRuntime(mode);
    const resolvedMode = resolveReaderModeFromTx(tx) ?? userMode;

    for (const ix of message.compiledInstructions) {
        const decoded = decodeReaderInstruction(ix, accountKeys);
        if (!decoded) {
            continue;
        }
        if (
            decoded.name === "user_inventory_code_in" ||
            decoded.name === "user_inventory_code_in_for_free" ||
            decoded.name === "db_code_in" ||
            decoded.name === "db_instruction_code_in" ||
            decoded.name === "wallet_connection_code_in"
        ) {
            const data = decoded.data as { on_chain_path: string; metadata: string };
            return {onChainPath: data.on_chain_path, metadata: data.metadata};
        }
    }
    throw new Error("user_inventory_code_in instruction not found");
};

// ----- user_inventory_code_in metadata parsing -----
export const extractCodeInPayload = (
    tx: VersionedTransactionResponse,
    mode: string = DEFAULT_CONTRACT_MODE,
): { onChainPath: string; metadata: string; inlineData: string | null } => {
    const {onChainPath, metadata} = decodeUserInventoryCodeIn(tx, mode);
    if (onChainPath.length > 0) {
        return {onChainPath, metadata, inlineData: null};
    }

    let data: string | null = null;
    let cleanedMetadata = metadata;
    try {
        const parsed = JSON.parse(metadata) as Record<string, unknown>;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            if (Object.prototype.hasOwnProperty.call(parsed, "data")) {
                const dataValue = parsed.data;
                delete parsed.data;
                cleanedMetadata = JSON.stringify(parsed);
                if (typeof dataValue === "string") {
                    data = dataValue;
                } else if (dataValue !== undefined && dataValue !== null) {
                    data = JSON.stringify(dataValue);
                }
            }
        }
    } catch {
        // ignore malformed metadata
    }
    return {onChainPath, metadata: cleanedMetadata, inlineData: data};
};

// ----- account transaction & list fetchers -----
export async function fetchAccountTransactions( // this use for bringing the db pda list, session chunk list, friend list , we dont check data here bacause it increases rpc call
    account: string | PublicKey,
    options: { before?: string; limit?: number } = {},
) {
    const {before, limit} = options;
    if (typeof limit === "number" && limit <= 0) {
        return [];
    }

    const pubkey = typeof account === "string" ? new PublicKey(account) : account;
    return getConnection().getSignaturesForAddress(pubkey, {before, limit});
}

export async function getSessionPdaList(
    userPubkey: string,
    mode: string = DEFAULT_CONTRACT_MODE,
): Promise<string[]> {
    const connection = getConnection();
    const user = new PublicKey(userPubkey);
    const programId = resolveReaderProgramId(mode);
    const userState = getUserPda(user, programId);
    const info = await connection.getAccountInfo(userState);
    if (!info) {
        throw new Error("user_state not found");
    }
    const decoded = readerContext.accountCoder.decode("UserState", info.data) as {
        total_session_files: { toString(): string };
    };
    const totalSessionFiles = BigInt(decoded.total_session_files.toString());
    const sessions: string[] = [];

    for (let seq = BigInt(0); seq < totalSessionFiles; seq += BigInt(1)) {
        const session = getSessionPda(user, seq, programId);
        sessions.push(session.toBase58());
    }
    return sessions;
}

// ----- connection list fetcher -----
export async function fetchUserConnections(
    userPubkey: PublicKey | string,
    options?: {
        limit?: number;
        before?: string;
        speed?: "light" | "medium" | "heavy" | "extreme";
        mode?: string;
    },
): Promise<
    Array<{
        dbRootId: string;
        partyA: string;
        partyB: string;
        status: "pending" | "approved" | "blocked";
        requester: "a" | "b";
        blocker: "a" | "b" | "none";
        timestamp?: number;
    }>
> {
    const {decodeConnectionMeta} = await import("../utils/global_fetch");

    // 1. Calculate UserState PDA
    const mode = options?.mode ?? DEFAULT_CONTRACT_MODE;
    const programId = resolveReaderProgramId(mode);
    const pubkey = typeof userPubkey === "string" ? new PublicKey(userPubkey) : userPubkey;
    const userState = getUserPda(pubkey, programId);

    // 2. Fetch transaction history
    const {before, limit} = options ?? {};
    const signatures = await fetchAccountTransactions(userState, {before, limit});

    // 3. Filter request_connection instructions and collect Connection PDA addresses
    const connectionPdaSet = new Set<string>();
    const connectionPdaData: Array<{
        connectionPda: PublicKey;
        timestamp?: number;
    }> = [];

    for (const sig of signatures) {
        const connection = getConnection();
        let tx: VersionedTransactionResponse | null;
        try {
            tx = await connection.getTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0,
            });
        } catch {
            continue;
        }
        if (!tx) {
            continue;
        }

        const message = tx.transaction.message;
        const accountKeys = message.getAccountKeys();

        for (const ix of message.compiledInstructions) {
            const decoded = decodeReaderInstruction(ix, accountKeys);
            if (!decoded || decoded.name !== "request_connection") {
                continue;
            }

            // Extract connection_table PDA from instruction accounts
            // connection_table is at index 2 in the accounts array
            const connectionTablePubkey = accountKeys.get(ix.accountKeyIndexes[2]);
            if (!connectionTablePubkey) {
                continue;
            }

            const pdaKey = connectionTablePubkey.toBase58();
            if (!connectionPdaSet.has(pdaKey)) {
                connectionPdaSet.add(pdaKey);
                connectionPdaData.push({
                    connectionPda: connectionTablePubkey,
                    timestamp: sig.blockTime ?? undefined,
                });
            }
        }
    }

    // 4. Create rate limiter based on speed profile
    const speedKey = resolveSessionSpeed(options?.speed);
    const profile = SESSION_SPEED_PROFILES[speedKey];
    const rateLimiter = createRateLimiter(profile.maxRps);

    // 5. Fetch Connection PDA data with rate limiting
    const connection = getConnection();
    const connections = await Promise.all(
        connectionPdaData.map(async ({connectionPda, timestamp}) => {
            if (rateLimiter) {
                await rateLimiter.wait();
            }

            try {
                const info = await connection.getAccountInfo(connectionPda);
                if (!info) {
                    return null;
                }

                // Decode all info from Connection PDA
                const meta = decodeConnectionMeta(info.data);
                const partyA = meta.partyA.toBase58();
                const partyB = meta.partyB.toBase58();

                const statusNum = meta.status;
                const status: "pending" | "approved" | "blocked" =
                    statusNum === 0 ? "pending" :
                    statusNum === 1 ? "approved" :
                    statusNum === 2 ? "blocked" : "pending";

                const requester: "a" | "b" = meta.requester === 0 ? "a" : "b";
                const blocker: "a" | "b" | "none" =
                    meta.blocker === 0 ? "a" :
                    meta.blocker === 1 ? "b" : "none";

                return {
                    dbRootId: meta.dbRootId,
                    partyA,
                    partyB,
                    status,
                    requester,
                    blocker,
                    timestamp,
                };
            } catch {
                return null;
            }
        }),
    );

    return connections.filter((c) => c !== null) as Array<{
        dbRootId: string;
        partyA: string;
        partyB: string;
        status: "pending" | "approved" | "blocked";
        requester: "a" | "b";
        blocker: "a" | "b" | "none";
        timestamp?: number;
    }>;
}
