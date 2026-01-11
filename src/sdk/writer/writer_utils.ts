import {Connection, Transaction, TransactionInstruction, type PublicKey} from "@solana/web3.js";
import {userInitializeInstruction, type InstructionBuilder} from "../../contract";
import {
    getCachedAccountExists,
    markAccountExists,
    refreshAccountExists,
} from "../utils/account_cache";
import {toWalletSigner, type SignerInput} from "../utils/wallet";

export async function sendTx(
    connection: Connection,
    signer: SignerInput,
    instructions: TransactionInstruction | TransactionInstruction[],
) {
    const wallet = toWalletSigner(signer);
    const tx = new Transaction();
    if (Array.isArray(instructions)) {
        tx.add(...instructions);
    } else {
        tx.add(instructions);
    }

    const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    const signed = await wallet.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({signature, blockhash, lastValidBlockHeight});

    return signature;
}

export async function ensureUserInitialized(
    connection: Connection,
    signer: SignerInput,
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        code_account: PublicKey;
        user_state: PublicKey;
        user_inventory: PublicKey;
        system_program?: PublicKey;
    },
) {
    let exists = await getCachedAccountExists(connection, accounts.user_inventory);
    if (!exists) {
        exists = await refreshAccountExists(connection, accounts.user_inventory);
    }
    if (exists) {
        return;
    }
    const ix = userInitializeInstruction(builder, accounts);
    await sendTx(connection, signer, ix);
    markAccountExists(accounts.user_inventory, true);
}
