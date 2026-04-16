import { BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { type SignerInput } from "../utils/wallet";
export declare function prepareCodeIn(input: {
    connection: Connection;
    signer: SignerInput;
}, data: string | string[], filename?: string, method?: number, filetype?: string, onProgress?: (percent: number) => void, speed?: string): Promise<{
    builder: import("../../contract").InstructionBuilder;
    user: PublicKey;
    userInventory: PublicKey;
    onChainPath: string;
    metadata: string;
    sessionAccount: PublicKey | undefined;
    sessionFinalize: {
        seq: BN;
        total_chunks: number;
    } | null;
    feeReceiver: PublicKey;
    iqAta: PublicKey | null;
}>;
export declare function codeIn(input: {
    connection: Connection;
    signer: SignerInput;
}, data: string | string[], filename?: string, method?: number, filetype?: string, onProgress?: (percent: number) => void, speed?: string): Promise<string>;
