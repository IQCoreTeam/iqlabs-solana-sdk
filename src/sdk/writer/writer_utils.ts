import {
    Connection,
    Transaction,
    TransactionInstruction,
    sendAndConfirmTransaction,
    type PublicKey,
    type Signer,
} from "@solana/web3.js";
import {userInitializeInstruction, type InstructionBuilder} from "../../contract";
import {
    getCachedAccountExists,
    markAccountExists,
    refreshAccountExists,
} from "../utils/account_cache";

export async function sendTx(
    connection: Connection,
    signer: Signer,
    instructions: TransactionInstruction | TransactionInstruction[],
) {
    const tx = new Transaction();
    if (Array.isArray(instructions)) {
        tx.add(...instructions);
    } else {
        tx.add(instructions);
    }
    return sendAndConfirmTransaction(connection, tx, [signer]);
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
    let exists = await getCachedAccountExists(connection, accounts.db_account);
    if (!exists) {
        exists = await refreshAccountExists(connection, accounts.db_account);
    }
    if (exists) {
        return;
    }
    const ix = userInitializeInstruction(builder, accounts);
    await sendTx(connection, signer, ix);
    markAccountExists(accounts.db_account, true);
}
