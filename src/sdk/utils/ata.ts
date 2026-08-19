import {Connection, PublicKey} from "@solana/web3.js";
import {getCachedAccountExists, refreshAccountExists} from "../writer/writer_utils";

const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

// tokenProgramId defaults to the legacy program, so every existing caller is byte-for-byte
// unchanged; pass the Token-2022 id when the mint lives there (its ATA is seeded with that id).
export const findAssociatedTokenAddress = (
    owner: PublicKey,
    mint: PublicKey,
    tokenProgramId: PublicKey = TOKEN_PROGRAM_ID,
) =>
    PublicKey.findProgramAddressSync(
        [owner.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID,
    )[0];

// Which token program owns this mint. Legacy is the fallback, so a missing/unreadable mint
// (or an RPC hiccup) resolves exactly as before — this only ever ADDS the Token-2022 branch.
async function mintTokenProgram(
    connection: Connection,
    mint: PublicKey,
): Promise<PublicKey> {
    try {
        const info = await connection.getAccountInfo(mint);
        if (info && info.owner.equals(TOKEN_2022_PROGRAM_ID)) {
            return TOKEN_2022_PROGRAM_ID;
        }
    } catch {
        /* fall through to legacy */
    }
    return TOKEN_PROGRAM_ID;
}

export async function resolveAssociatedTokenAccount(
    connection: Connection,
    owner: PublicKey,
    mint: PublicKey,
    requireExists = true,
) {
    const tokenProgramId = await mintTokenProgram(connection, mint);
    const ata = findAssociatedTokenAddress(owner, mint, tokenProgramId);
    let exists = await getCachedAccountExists(connection, ata);
    if (!exists && requireExists) {
        exists = await refreshAccountExists(connection, ata);
    }
    if (!exists) {
        if (requireExists) {
            throw new Error("missing signer_ata");
        }
        return null;
    }
    return ata;
}
