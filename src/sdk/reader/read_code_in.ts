import {getConnection} from "../utils/connection_helper";
import {resolveTableTrailPayload} from "./reader_utils";
import {readDbCodeInFromTx, readDbRowContent} from "./reading_flow";
import {DEFAULT_CONTRACT_MODE} from "../constants";
import {resolveReaderModeFromTx} from "./reader_context";

export async function readCodeIn(
    txSignature: string,
    speed?: string,
    mode: string = DEFAULT_CONTRACT_MODE,
): Promise<{ metadata: string; data: string | null }> {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }

    const resolvedMode = resolveReaderModeFromTx(tx, mode);
    const tablePayload = resolveTableTrailPayload(
        tx.meta?.logMessages ?? [],
        resolvedMode,
    );
    if (tablePayload) {
        return readDbRowContent(tablePayload, speed, resolvedMode);
    }

    return await readDbCodeInFromTx(tx, speed, resolvedMode);
}
