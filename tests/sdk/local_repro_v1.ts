// Verify the v1.53-built binary handles a full-size v1-profile send_code
// (3600-byte chunk) delivered via the SIMD-0385 v1 wire format, then read
// the code account back.
import { Connection, Keypair } from "@solana/web3.js";
import { readFileSync } from "fs";
import { homedir } from "os";
import { createInstructionBuilder, sendCodeInstruction } from "../../src/contract/instructions";
import { getCodeAccountPda } from "../../src/contract/pda";
import { buildV1Transaction } from "../../src/sdk/writer/v1_tx";

async function main() {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8")))
  );

  const chunk = "가나다라마바사아자차카타파하".repeat(90).slice(0, 1200); // 3600 bytes UTF-8
  console.log("chunk bytes:", Buffer.byteLength(chunk, "utf8"));

  const builder = createInstructionBuilder();
  const ix = sendCodeInstruction(
    builder,
    { user: payer.publicKey, code_account: getCodeAccountPda(payer.publicKey) },
    { code: chunk, before_tx: "Genesis", method: 0, decode_break: 0 }
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const { raw } = buildV1Transaction(payer, [ix], blockhash);
  console.log("v1 tx size:", raw.length);

  const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  console.log("sent v1 tx:", sig);

  const tx = await connection.getTransaction(sig, { maxSupportedTransactionVersion: 1 });
  console.log("fetched version:", tx?.version, "err:", JSON.stringify(tx?.meta?.err));

  const acct = await connection.getAccountInfo(getCodeAccountPda(payer.publicKey));
  console.log("code_account size:", acct?.data.length);
}

main().catch((e) => {
  console.error("FATAL:", e.message ?? e);
  process.exit(1);
});
