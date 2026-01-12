import {Connection, PublicKey} from "@solana/web3.js";
import {getCachedAccountExists, refreshAccountExists} from "../writer/writer_utils";

const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export const findAssociatedTokenAddress = (
    owner: PublicKey,
    mint: PublicKey,
) =>
    PublicKey.findProgramAddressSync(
        [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID,
    )[0];

export async function resolveAssociatedTokenAccount(
    connection: Connection,
    owner: PublicKey,
    mint: PublicKey,
    requireExists = true,
) {
    const ata = findAssociatedTokenAddress(owner, mint);
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
