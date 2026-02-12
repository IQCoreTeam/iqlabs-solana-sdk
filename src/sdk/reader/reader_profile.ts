import {type VersionedTransactionResponse} from "@solana/web3.js";
import {getConnection} from "../utils/connection_helper";
import {decodeReaderInstruction} from "./reader_utils";

const DAY_SECONDS = 86_400;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const SIG_MIN_LEN = 80;

const resolveOnChainPath = (
    tx: VersionedTransactionResponse,
): string => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys(
        tx.meta?.loadedAddresses
            ? {accountKeysFromLookups: tx.meta.loadedAddresses}
            : undefined,
    );

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
            const data = decoded.data as { on_chain_path: string };
            return data.on_chain_path;
        }
    }

    throw new Error("user_inventory_code_in instruction not found");
};

export const resolveReadMode = (
    onChainPath: string,
    blockTime?: number | null,
): { freshness?: "fresh" | "recent" | "archive" } => {
    const now = Math.floor(Date.now() / 1000);
    const ageSeconds =
        typeof blockTime === "number" ? Math.max(0, now - blockTime) : null;
    if (onChainPath.length === 0) {
        const freshness =
            ageSeconds !== null && ageSeconds <= DAY_SECONDS ? "fresh" : "recent";
        return {freshness};
    }
    const kind = onChainPath.length >= SIG_MIN_LEN ? "linked_list" : "session";

    if (kind === "linked_list") {
        const freshness =
            ageSeconds !== null && ageSeconds <= DAY_SECONDS ? "fresh" : "recent";
        return {freshness};
    }
    if (ageSeconds !== null && ageSeconds <= DAY_SECONDS) {
        return {freshness: "fresh"};
    }
    if (ageSeconds !== null && ageSeconds <= WEEK_SECONDS) {
        return {freshness: "recent"};
    }
    return {freshness: "archive"};
};

export async function decideReadMode(
    txSignature: string,
): Promise<{ freshness?: "fresh" | "recent" | "archive" }> {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }
    const onChainPath = resolveOnChainPath(tx);
    return resolveReadMode(onChainPath, tx.blockTime);
}
