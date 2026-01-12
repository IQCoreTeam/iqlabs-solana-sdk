import {resolveContractRuntime} from "../../contract";
import {getConnection} from "../utils/connection_helper";
import {resolveReaderModeFromTx} from "./reader_context";
import {readUserInventoryCodeInFromTx} from "./reading_flow";

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
    return await readUserInventoryCodeInFromTx(tx, speed, resolvedMode, onProgress);
}
