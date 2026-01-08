import {getConnection} from "../utils/connection_helper";
import {extractCodeInPayload, resolveTableTrailPayload} from "./reader_utils";
import {readDbCodeInFromTx, readDbRowContent} from "./reading_flow";

export async function readCodeIn(
    txSignature: string,
    speed?: string,
): Promise<{ metadata: string; data: string | null }> {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }

    const tablePayload = resolveTableTrailPayload(tx.meta?.logMessages ?? []);
    if (tablePayload) {
        return readDbRowContent(tablePayload, speed);
    }

    return await readDbCodeInFromTx(tx, speed);
}
