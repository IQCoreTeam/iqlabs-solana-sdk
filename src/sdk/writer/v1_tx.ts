import {utils} from "@coral-xyz/anchor";
import {ed25519} from "@noble/curves/ed25519.js";
import {
    Connection,
    Transaction,
    TransactionInstruction,
    type Signer,
} from "@solana/web3.js";

// v1 transactions execute with a zero compute budget unless the limits are set
// explicitly, so every v1 tx carries these via the config mask (SIMD-0385).
const COMPUTE_UNIT_LIMIT = 200_000;
const LOADED_ACCOUNTS_DATA_SIZE_LIMIT = 32 * 1024 * 1024;

const V1_VERSION_BYTE = 129;
// Config mask bits: 0+1 priority fee (u64), 2 compute unit limit, 3 loaded
// accounts data size limit, 4 heap size. We set 2 and 3.
const CONFIG_MASK = (1 << 2) | (1 << 3);

const u32le = (value: number) => {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(value, 0);
    return buf;
};

/**
 * Serialize instructions into a signed v1 transaction (SIMD-0296/0385).
 *
 * The v1 wire format is not the v0 envelope: signatures move to the end, the
 * compute budget lives in a config mask instead of instructions, and there are
 * no address table lookups. web3.js 1.x cannot build or sign it, so the bytes
 * are assembled here and signed directly with the keypair; account ordering
 * and index resolution reuse the legacy message compiler, which the spec
 * matches. This is why the v1 profile requires a raw keypair signer.
 */
export function buildV1Transaction(
    signer: Signer,
    instructions: TransactionInstruction[],
    recentBlockhash: string,
) {
    const legacy = new Transaction();
    legacy.add(...instructions);
    legacy.recentBlockhash = recentBlockhash;
    legacy.feePayer = signer.publicKey;
    const msg = legacy.compileMessage();

    if (msg.header.numRequiredSignatures !== 1) {
        throw new Error("v1 send path supports a single keypair signer");
    }
    if (msg.accountKeys.length > 64 || msg.instructions.length > 64) {
        throw new Error("v1 transactions allow at most 64 accounts and 64 instructions");
    }

    const bs58 = utils.bytes.bs58;
    const headers: Buffer[] = [];
    const payloads: Buffer[] = [];
    for (const ix of msg.instructions) {
        const data = Buffer.from(bs58.decode(ix.data));
        const header = Buffer.alloc(4);
        header.writeUInt8(ix.programIdIndex, 0);
        header.writeUInt8(ix.accounts.length, 1);
        header.writeUInt16LE(data.length, 2);
        headers.push(header);
        payloads.push(Buffer.from(ix.accounts), data);
    }

    const message = Buffer.concat([
        Buffer.from([
            V1_VERSION_BYTE,
            msg.header.numRequiredSignatures,
            msg.header.numReadonlySignedAccounts,
            msg.header.numReadonlyUnsignedAccounts,
        ]),
        u32le(CONFIG_MASK),
        Buffer.from(bs58.decode(msg.recentBlockhash)), // lifetime specifier
        Buffer.from([msg.instructions.length, msg.accountKeys.length]),
        ...msg.accountKeys.map((key) => key.toBuffer()),
        u32le(COMPUTE_UNIT_LIMIT),
        u32le(LOADED_ACCOUNTS_DATA_SIZE_LIMIT),
        ...headers,
        ...payloads,
    ]);

    // Signatures sign everything before the Signatures field and sit at the end.
    const signature = ed25519.sign(message, signer.secretKey.slice(0, 32));
    return {
        raw: Buffer.concat([message, Buffer.from(signature)]),
        signature: bs58.encode(signature),
    };
}

export async function sendTxV1(
    connection: Connection,
    signer: Signer,
    instructions: TransactionInstruction[],
    skipConfirmation = false,
) {
    const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
    const {raw} = buildV1Transaction(signer, instructions, blockhash);
    const signature = await connection.sendRawTransaction(raw);

    if (!skipConfirmation) {
        await confirmLanded(connection, signature, blockhash, lastValidBlockHeight);
    }
    return signature;
}

/**
 * Confirm without trusting blockheight expiry blindly. While waiting for
 * "finalized" the chain height can pass lastValidBlockHeight even though the
 * tx already landed, so the checker throws a false
 * TransactionExpiredBlockheightExceededError. On expiry, poll the signature
 * status a few times (gently, to stay under rate limits) and accept
 * confirmed/finalized before rethrowing. After a genuine expiry the tx can
 * never land, so callers may safely re-send.
 */
export async function confirmLanded(
    connection: Connection,
    signature: string,
    blockhash: string,
    lastValidBlockHeight: number,
) {
    try {
        // "confirmed", not "finalized": a mainnet timing trace showed the
        // finalized wait eating 47.7s of a 51s write on a public RPC, while
        // the tx is on chain (and gateway-readable) at confirmed in ~2s.
        await connection.confirmTransaction({signature, blockhash, lastValidBlockHeight}, "confirmed");
    } catch (e: any) {
        if (!e || e.name !== "TransactionExpiredBlockheightExceededError") throw e;
        for (let i = 0; i < 5; i++) {
            const st = (await connection.getSignatureStatuses([signature])).value[0];
            if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return;
            await new Promise((r) => setTimeout(r, 2500));
        }
        throw e;
    }
}
