import {getConnection} from "../utils/connection_helper";
import {readUserInventoryCodeInFromTx} from "./reading_flow";
import {type SessionSpeedOption} from "../utils/session_speed";

export async function readCodeIn(
    txSignature: string,
    speed?: SessionSpeedOption,
    onProgress?: (percent: number) => void,
): Promise<{ metadata: string; data: string | null }> {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }

    return await readUserInventoryCodeInFromTx(tx, speed, onProgress);
}
