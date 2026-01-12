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
