import {PublicKey, type VersionedTransactionResponse} from "@solana/web3.js";

import {
    CONNECTION_STATUS_APPROVED,
    CONNECTION_STATUS_BLOCKED,
    CONNECTION_STATUS_PENDING,
    getConnectionTablePda,
    getDbRootPda,
    getUserPda,
} from "../../contract";
import {getConnection, getReaderConnection} from "../utils/connection_helper";
import {decodeConnectionMeta} from "../utils/global_fetch";
import {deriveDmSeed, toSeedBytes} from "../utils/seed";
import {decideReadMode} from "./reader_profile";
import {readLinkedListResult, readSessionResult} from "./reading_methods";
import {readerContext} from "./reader_context";
import {ReplayServiceClient} from "./replayservice";

const {instructionCoder, accountCoder, anchorProfile, pinocchioProfile} =
    readerContext;
const SIG_MIN_LEN = 80;
const replayService = new ReplayServiceClient();

const decodeDbCodeIn = (
    tx: VersionedTransactionResponse,
): { onChainPath: string; metadata: string } => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys();

    for (const ix of message.compiledInstructions) {
        const programId = accountKeys.get(ix.programIdIndex);
        if (!programId) {
            continue;
        }
        const isAnchor = programId.equals(anchorProfile.programId);
        const isPinocchio =
            pinocchioProfile !== null &&
            programId.equals(pinocchioProfile.programId);
        if (!isAnchor && !isPinocchio) {
            continue;
        }
        const decoded = instructionCoder.decode(Buffer.from(ix.data));
        if (!decoded) {
            continue;
        }
        if (decoded.name === "db_code_in" || decoded.name === "db_code_in_for_free") {
            const data = decoded.data as { on_chain_path: string; metadata: string };
            return {onChainPath: data.on_chain_path, metadata: data.metadata};
        }
    }
    throw new Error("db_code_in instruction not found");
};

const resolveConnectionStatus = (status: number) => {
    if (status === CONNECTION_STATUS_PENDING) {
        return "pending";
    }
    if (status === CONNECTION_STATUS_APPROVED) {
        return "approved";
    }
    if (status === CONNECTION_STATUS_BLOCKED) {
        return "blocked";
    }
    return "unknown";
};


export async function readInscription(
    txSignature: string,
): Promise<{ result: string | null }> {
    const {onChainPath} = await readDBMetadata(txSignature);
    const readOption = await decideReadMode(txSignature);
    const kind = onChainPath.length >= SIG_MIN_LEN ? "linked_list" : "session";
    if (kind === "session") {
        return readSession(onChainPath, readOption);
    }
    return readLinkedListFromTail(onChainPath, readOption);
}

export async function readDBMetadata(txSignature: string): Promise<{
    onChainPath: string;
    metadata: string;
}> {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }
    return decodeDbCodeIn(tx);
}

export async function readSession(
    sessionPubkey: string,
    readOption: { isReplay: boolean; freshness?: "fresh" | "recent" | "archive" },
): Promise<{ result: string | null }> {
    if (readOption.isReplay || readOption.freshness === "archive") {
        await replayService.enqueueReplay({sessionPubkey});
        return {result: null};
    }
    const connection = getReaderConnection(readOption.freshness);
    const info = await connection.getAccountInfo(new PublicKey(sessionPubkey));
    if (!info) {
        throw new Error("session account not found");
    }
    return readSessionResult(sessionPubkey, readOption);
}

export async function readLinkedListFromTail(
    tailTx: string,
    readOption: { isReplay: boolean; freshness?: "fresh" | "recent" | "archive" },
    //we actually dont use is replay and archive in linked list but just left this for re using the type.
): Promise<{ result: string }> {
    const connection = getReaderConnection(readOption.freshness);
    const tx = await connection.getTransaction(tailTx, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("tail transaction not found");
    }
    return readLinkedListResult(tailTx, readOption);
}

export async function readUserState(userPubkey: string): Promise<{
    owner: string;
    metadata: string | null;
    totalSessionFiles: bigint;
    profileData?: string;
}> {
    const connection = getConnection();
    const user = new PublicKey(userPubkey);
    const userState = getUserPda(anchorProfile, user);
    const info = await connection.getAccountInfo(userState);
    if (!info) {
        throw new Error("user_state not found");
    }
    const decoded = accountCoder.decode("UserState", info.data) as {
        owner: PublicKey;
        metadata: Uint8Array;
        total_session_files: { toString(): string };
    };
    const rawMetadata = Buffer.from(decoded.metadata).toString("utf8");
    const metadata = rawMetadata.replace(/\0+$/, "").trim() || null;
    const totalSessionFiles = BigInt(decoded.total_session_files.toString());
    if (metadata) {
        const {result} = await readInscription(metadata);
        const profileData = result ?? undefined;
        return {
            owner: decoded.owner.toBase58(),
            metadata,
            totalSessionFiles,
            profileData,
        };
    }
    return {
        owner: decoded.owner.toBase58(),
        metadata: null,
        totalSessionFiles,
    };
}

export async function readConnection(
    dbRootId: Uint8Array | string,
    partyA: string,
    partyB: string,
): Promise<{ status: string }> {
    const connection = getConnection();
    const dbRootSeed = toSeedBytes(dbRootId);
    const dbRoot = getDbRootPda(anchorProfile, dbRootSeed);
    const connectionSeed = deriveDmSeed(partyA, partyB);
    const connectionTable = getConnectionTablePda(
        anchorProfile,
        dbRoot,
        connectionSeed,
    );
    const info = await connection.getAccountInfo(connectionTable);
    if (!info) {
        throw new Error("connection table not found");
    }
    const meta = decodeConnectionMeta(info.data);
    return {status: resolveConnectionStatus(meta.status)};
}
