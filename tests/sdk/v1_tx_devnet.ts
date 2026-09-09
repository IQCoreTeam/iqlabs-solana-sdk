// Manual devnet check for the v1 tx wire format (run: npx tsx tests/sdk/v1_tx_devnet.ts).
// Airdrops to a throwaway keypair, sends a 1-lamport self-transfer as a v1
// transaction, and prints the confirmed signature. Devnet has the v1 feature
// gate active, so a confirmation proves the patched-envelope serialization.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {Connection, Keypair, SystemProgram} from "@solana/web3.js";
import {sendTxV1} from "../../src/sdk/writer/v1_tx";
import {isTxV1Active} from "../../src/sdk/utils/tx_profile";

const loadKeypair = () => {
    const keypairPath = process.env.V1_TEST_KEYPAIR ?? path.join(os.homedir(), ".config/solana/id.json");
    const secret = JSON.parse(fs.readFileSync(keypairPath, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
};

const main = async () => {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    console.log("v1 gate active on devnet:", await isTxV1Active(connection));

    const payer = loadKeypair();
    console.log("payer:", payer.publicKey.toBase58());

    const ix = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: payer.publicKey,
        lamports: 1,
    });
    const signature = await sendTxV1(connection, payer, [ix]);
    console.log("v1 tx confirmed:", signature);

    const tx = await connection.getTransaction(signature, {maxSupportedTransactionVersion: 1});
    console.log("fetched version:", tx?.version);
};

main().catch((e) => {
    console.error("v1 devnet check failed:", e);
    process.exit(1);
});
