import {type VersionedTransactionResponse} from "@solana/web3.js";
import {getConnection} from "../utils/connection_helper";
import {readerContext} from "./reader_context";

const {instructionCoder, anchorProfile, pinocchioProfile} = readerContext;

const DAY_SECONDS = 86_400;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const SIG_MIN_LEN = 80;

const resolveOnChainPath = (tx: VersionedTransactionResponse): string => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys(
        tx.meta?.loadedAddresses
            ? {accountKeysFromLookups: tx.meta.loadedAddresses}
            : undefined,
    );

    for (const ix of message.compiledInstructions) {
        const programId = accountKeys.get(ix.programIdIndex);
        if (!programId) {
            continue;
        }
        const isAnchor = programId.equals(anchorProfile.programId);
        const isPinocchio = programId.equals(pinocchioProfile.programId);
        if (!isAnchor && !isPinocchio) {
            continue;
        }
        const decoded = instructionCoder.decode(Buffer.from(ix.data));
        if (!decoded) {
            continue;
        }
        if (decoded.name === "db_code_in" || decoded.name === "db_code_in_for_free") {
            const data = decoded.data as { on_chain_path: string };
            return data.on_chain_path;
        }
    }

    throw new Error("db_code_in instruction not found");
};


export async function decideReadMode(
    txSignature: string,
): Promise<{ isReplay: boolean; freshness?: "fresh" | "recent" | "archive" }> {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }
    const blockTime = tx.blockTime;
    const now = Math.floor(Date.now() / 1000);
    const ageSeconds =
        typeof blockTime === "number" ? Math.max(0, now - blockTime) : null;
    const onChainPath = resolveOnChainPath(tx);
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
}
