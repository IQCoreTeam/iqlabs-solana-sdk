import {
    Connection,
    Transaction,
    TransactionInstruction,
    sendAndConfirmTransaction,
    type PublicKey,
    type Signer,
} from "@solana/web3.js";
import {userInitializeInstruction, type InstructionBuilder} from "../../contract";

export async function sendTx(
    connection: Connection,
    signer: Signer,
    instructions: TransactionInstruction | TransactionInstruction[],
    options?: { label?: string; log?: boolean },
) {
    const tx = new Transaction();
    if (Array.isArray(instructions)) {
        tx.add(...instructions);
    } else {
        tx.add(instructions);
    }
    const signature = await sendAndConfirmTransaction(connection, tx, [signer]);
    const shouldLog =
        options?.log || process.env.IQLABS_LOG_TX === "1" || false;
    if (shouldLog) {
        const label = options?.label ? ` ${options.label}` : "";
        console.log(`[tx]${label} ${signature}`);
    }
    return signature;
}

export async function ensureUserInitialized(
    connection: Connection,
    signer: Signer,
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        code_account: PublicKey;
        user_state: PublicKey;
        db_account: PublicKey;
        system_program?: PublicKey;
    },
) {
    const info = await connection.getAccountInfo(accounts.db_account);
    if (info) {
        return;
    }
    const ix = userInitializeInstruction(builder, accounts);
    await sendTx(connection, signer, ix, {label: "user_initialize"});
}
