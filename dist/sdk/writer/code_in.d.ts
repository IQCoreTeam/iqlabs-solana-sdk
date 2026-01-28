import { BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { type SignerInput } from "../utils/wallet";
export declare function prepareCodeIn(input: {
    connection: Connection;
    signer: SignerInput;
}, chunks: string[], mode?: string, filename?: string, method?: number, filetype?: string, onProgress?: (percent: number) => void): Promise<{
    builder: import("../../contract").InstructionBuilder;
    user: PublicKey;
    userInventory: PublicKey;
    onChainPath: string;
    metadata: string;
    sessionAccount: PublicKey;
    sessionFinalize: {
        seq: BN;
        total_chunks: number;
    };
    feeReceiver: PublicKey;
    iqAta: PublicKey;
}>;
export declare function codeIn(input: {
    connection: Connection;
    signer: SignerInput;
}, chunks: string[], mode?: string, filename?: string, method?: number, filetype?: string, onProgress?: (percent: number) => void): Promise<string>;
