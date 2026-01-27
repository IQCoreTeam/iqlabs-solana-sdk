import {Connection, Keypair, LAMPORTS_PER_SOL} from "@solana/web3.js";
import {reader, setRpcUrl, writer} from "iqlabs-solana-sdk";

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
setRpcUrl(RPC_URL);

const connection = new Connection(RPC_URL, "confirmed");
const signer = Keypair.generate();

async function airdropIfNeeded() {
    const balance = await connection.getBalance(signer.publicKey);
    if (balance >= 0.5 * LAMPORTS_PER_SOL) {
        return;
    }
    const sig = await connection.requestAirdrop(
        signer.publicKey,
        LAMPORTS_PER_SOL,
    );
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
        {
            signature: sig,
            blockhash: latest.blockhash,
            lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed",
    );
}

async function main() {
    await airdropIfNeeded();

    const payload = "hello";
    const signature = await writer.codeIn({connection, signer}, [payload]);
    console.log("tx:", signature);

    const {metadata, data} = await reader.readCodeIn(signature);
    console.log("metadata:", metadata);
    console.log("data:", data);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
