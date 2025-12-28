import {
  Connection,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  type Signer,
} from "@solana/web3.js";

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
