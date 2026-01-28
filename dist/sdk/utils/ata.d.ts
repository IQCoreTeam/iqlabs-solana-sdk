import { Connection, PublicKey } from "@solana/web3.js";
export declare const findAssociatedTokenAddress: (owner: PublicKey, mint: PublicKey) => PublicKey;
export declare function resolveAssociatedTokenAccount(connection: Connection, owner: PublicKey, mint: PublicKey, requireExists?: boolean): Promise<PublicKey>;
