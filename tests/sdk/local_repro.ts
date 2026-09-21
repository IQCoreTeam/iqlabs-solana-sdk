// Local reproduction of the mainnet memory-access-violation on the new binary.
// Sends user_initialize (happy path) against a local test validator running
// the freshly built iqlabs.so at the production program id.
import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { readFileSync } from "fs";
import { homedir } from "os";
import { createInstructionBuilder, userInitializeInstruction } from "../../src/contract/instructions";
import { getCodeAccountPda, getUserPda, getUserInventoryPda } from "../../src/contract/pda";

async function main() {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8")))
  );
  console.log("payer:", payer.publicKey.toBase58());

  const builder = createInstructionBuilder();
  const ix = userInitializeInstruction(builder, {
    user: payer.publicKey,
    code_account: getCodeAccountPda(payer.publicKey),
    user_state: getUserPda(payer.publicKey),
    user_inventory: getUserInventoryPda(payer.publicKey),
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(payer);

  const sim = await connection.simulateTransaction(tx);
  console.log("simulate err:", JSON.stringify(sim.value.err));
  for (const l of sim.value.logs ?? []) console.log(l);

  if (!sim.value.err) {
    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log("sent:", sig);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
