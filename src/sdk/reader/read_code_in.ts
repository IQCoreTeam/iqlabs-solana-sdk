import {getConnection} from "../utils/connection_helper";
import {resolveTableTrailPayload} from "./reader_utils";
import {readDbCodeInFromTx, readDbRowContent} from "./reading_flow";
import {resolveReaderModeFromTx} from "./reader_context";
import {resolveContractRuntime} from "../../contract";

export async function readCodeIn(
    txSignature: string,
    speed?: string,
    onProgress?: (percent: number) => void,
): Promise<{ metadata: string; data: string | null }> {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }

    const userMode = resolveContractRuntime();
    const resolvedMode = resolveReaderModeFromTx(tx) ?? userMode;
    const tablePayload = resolveTableTrailPayload(
        tx.meta?.logMessages ?? [],
        resolvedMode,
    );
    if (tablePayload) {
        return readDbRowContent(tablePayload, speed, resolvedMode, onProgress);
    }

    return await readDbCodeInFromTx(tx, speed, resolvedMode, onProgress);
}
