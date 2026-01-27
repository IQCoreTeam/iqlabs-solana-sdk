import {readFileSync} from "node:fs";
import {homedir} from "node:os";
import {resolve} from "node:path";
import {Connection, Keypair, LAMPORTS_PER_SOL} from "@solana/web3.js";
import {createClient, setRpcUrl, toWalletSigner} from "@iqlabs/solana-sdk";

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
setRpcUrl(RPC_URL);

const connection = new Connection(RPC_URL, "confirmed");

function expandHome(pathValue: string) {
    if (!pathValue.startsWith("~/")) {
        return pathValue;
    }
    return resolve(homedir(), pathValue.slice(2));
}

function parseKeypairArg(): string | null {
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--keypair" || arg === "-k") {
            const next = argv[i + 1];
            if (!next || next.startsWith("-")) {
                throw new Error("Missing value for --keypair/-k");
            }
            return next;
        }
        if (arg.startsWith("--keypair=")) {
            return arg.slice("--keypair=".length);
        }
        if (arg.startsWith("-k=")) {
            return arg.slice("-k=".length);
        }
    }
    return null;
}

function loadKeypairFromJson(raw: string, label: string): Keypair {
    try {
        const parsed = JSON.parse(raw) as number[];
        return Keypair.fromSecretKey(Uint8Array.from(parsed));
    } catch (err) {
        throw new Error(`Failed to load keypair ${label}: ${(err as Error).message}`);
    }
}

function loadKeypairFromFile(pathValue: string): Keypair {
    const resolved = expandHome(pathValue);
    const raw = readFileSync(resolved, "utf8");
    return loadKeypairFromJson(raw, `from file ${resolved}`);
}

function loadKeypairFromEnv(): Keypair | null {
    const keypairPath =
        process.env.SOLANA_KEYPAIR_PATH ??
        process.env.SOLANA_KEYPAIR ??
        process.env.ANCHOR_WALLET;
    const keypairJson =
        process.env.SOLANA_KEYPAIR_JSON ?? process.env.SOLANA_KEYPAIR_CONTENT;

    if (keypairJson) {
        return loadKeypairFromJson(keypairJson, "from env JSON");
    }
    if (keypairPath) {
        return loadKeypairFromFile(keypairPath);
    }

    return null;
}

const cliKeypairPath = parseKeypairArg();
const envKeypair = loadKeypairFromEnv();
const signer = cliKeypairPath
    ? loadKeypairFromFile(cliKeypairPath)
    : envKeypair ?? Keypair.generate();
const userProvidedKeypair = Boolean(cliKeypairPath || envKeypair);
const client = createClient({connection, signer: toWalletSigner(signer)});
const {reader, writer} = client;

async function airdropIfNeeded() {
    if (userProvidedKeypair) {
        console.log("Using provided keypair; skipping auto-airdrop.");
        return;
    }
    console.log("Checking devnet balance for temp signer...");
    const balance = await connection.getBalance(signer.publicKey);
    if (balance >= 0.5 * LAMPORTS_PER_SOL) {
        console.log("Balance is sufficient; skipping airdrop.");
        return;
    }
    console.log("Requesting airdrop (1 SOL)...");
    try {
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
        console.log("Airdrop confirmed.");
    } catch (err) {
        console.warn("Airdrop failed; use a funded keypair instead.");
        console.warn(
            "Use --keypair /path/to/id.json or set SOLANA_KEYPAIR_PATH.",
        );
        throw err;
    }
}

async function main() {
    console.log(`Using RPC: ${RPC_URL}`);
    if (cliKeypairPath) {
        console.log(`Using keypair file: ${cliKeypairPath}`);
    }
    console.log(`Signer: ${signer.publicKey.toBase58()}`);
    await airdropIfNeeded();

    const payload = "hello";
    console.log("Writing payload with codeIn...");
    const signature = await writer.codeIn([payload]);
    console.log("tx:", signature);

    console.log("Reading back with readCodeIn...");
    const {metadata, data} = await reader.readCodeIn(signature);
    console.log("metadata:", metadata);
    console.log("data:", data);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
