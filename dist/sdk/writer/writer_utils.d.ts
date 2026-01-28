import { Connection, TransactionInstruction, type PublicKey } from "@solana/web3.js";
import { type InstructionBuilder } from "../../contract";
import { type SignerInput } from "../utils/wallet";
export declare function getCachedAccountExists(connection: Connection, pubkey: PublicKey): Promise<boolean>;
export declare function refreshAccountExists(connection: Connection, pubkey: PublicKey): Promise<boolean>;
export declare function readMagicBytes(chunk: string): {
    ext: string;
    mime: string;
};
export declare function sendTx(connection: Connection, signer: SignerInput, instructions: TransactionInstruction | TransactionInstruction[]): Promise<string>;
export declare function ensureUserInitialized(connection: Connection, signer: SignerInput, builder: InstructionBuilder, accounts: {
    user: PublicKey;
    code_account: PublicKey;
    user_state: PublicKey;
    user_inventory: PublicKey;
    system_program?: PublicKey;
}): Promise<void>;
