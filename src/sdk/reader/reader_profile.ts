import {type VersionedTransactionResponse} from "@solana/web3.js";
import {DEFAULT_CONTRACT_MODE} from "../constants";
import {getConnection} from "../utils/connection_helper";
import {resolveReaderModeFromTx} from "./reader_context";
import {decodeReaderInstruction} from "./reader_utils";

const DAY_SECONDS = 86_400;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const SIG_MIN_LEN = 80;

const resolveOnChainPath = (
    tx: VersionedTransactionResponse,
    mode: string = DEFAULT_CONTRACT_MODE,
): string => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys(
        tx.meta?.loadedAddresses
            ? {accountKeysFromLookups: tx.meta.loadedAddresses}
            : undefined,
    );
    const resolvedMode = resolveReaderModeFromTx(tx, mode);

    for (const ix of message.compiledInstructions) {
        const decodedResult = decodeReaderInstruction(
            ix,
            accountKeys,
            resolvedMode,
        );
        if (!decodedResult || !decodedResult.decoded) {
            continue;
        }
        const {decoded} = decodedResult;
        if (decoded.name === "db_code_in" || decoded.name === "db_code_in_for_free") {
            const data = decoded.data as { on_chain_path: string };
            return data.on_chain_path;
        }
    }

    throw new Error("db_code_in instruction not found");
};

export const resolveReadMode = (
    onChainPath: string,
    blockTime?: number | null,
): { isReplay: boolean; freshness?: "fresh" | "recent" | "archive" } => {
    const now = Math.floor(Date.now() / 1000);
    const ageSeconds =
        typeof blockTime === "number" ? Math.max(0, now - blockTime) : null;
    if (onChainPath.length === 0) {
        const freshness =
            ageSeconds !== null && ageSeconds <= DAY_SECONDS ? "fresh" : "recent";
        return {isReplay: false, freshness};
    }
    const kind = onChainPath.length >= SIG_MIN_LEN ? "linked_list" : "session";

    if (kind === "linked_list") {
        const freshness =
            ageSeconds !== null && ageSeconds <= DAY_SECONDS ? "fresh" : "recent";
        return {isReplay: false, freshness};
    }
    if (ageSeconds !== null && ageSeconds <= DAY_SECONDS) {
        return {isReplay: false, freshness: "fresh"};
    }
    if (ageSeconds !== null && ageSeconds <= WEEK_SECONDS) {
        return {isReplay: false, freshness: "recent"};
    }
    return {isReplay: true, freshness: "archive"};
};

export async function decideReadMode(
    txSignature: string,
    mode: string = DEFAULT_CONTRACT_MODE,
): Promise<{ isReplay: boolean; freshness?: "fresh" | "recent" | "archive" }> {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }
    const onChainPath = resolveOnChainPath(tx, mode);
    return resolveReadMode(onChainPath, tx.blockTime);
}
