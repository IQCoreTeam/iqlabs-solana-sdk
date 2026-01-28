import { BorshAccountsCoder, BorshInstructionCoder, type Idl } from "@coral-xyz/anchor";
import { PublicKey, type VersionedTransactionResponse } from "@solana/web3.js";
export declare const readerContext: {
    readonly idl: Idl;
    readonly instructionCoder: BorshInstructionCoder;
    readonly accountCoder: BorshAccountsCoder<string>;
    readonly anchorProgramId: PublicKey;
    readonly pinocchioProgramId: PublicKey;
};
export declare const resolveReaderProgramId: (mode?: string) => PublicKey;
export declare const resolveReaderModeFromTx: (tx: VersionedTransactionResponse) => "anchor" | "pinocchio";
