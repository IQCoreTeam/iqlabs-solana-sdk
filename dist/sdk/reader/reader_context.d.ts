import { BorshAccountsCoder, BorshInstructionCoder, type Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
export declare const readerContext: {
    readonly idl: Idl;
    readonly instructionCoder: BorshInstructionCoder;
    readonly accountCoder: BorshAccountsCoder<string>;
    readonly anchorProgramId: PublicKey;
};
