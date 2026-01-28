import { Connection, type PublicKey } from "@solana/web3.js";
import { type InstructionBuilder } from "../../contract";
import type { SignerInput } from "../utils/wallet";
export declare function uploadLinkedList(connection: Connection, signer: SignerInput, builder: InstructionBuilder, user: PublicKey, codeAccount: PublicKey, chunks: string[], method: number, onProgress?: (percent: number) => void, options?: {
    speed?: string;
}): Promise<string>;
export declare function uploadSession(connection: Connection, signer: SignerInput, builder: InstructionBuilder, programId: PublicKey, user: PublicKey, userState: PublicKey, seq: bigint, chunks: string[], method: number, options?: {
    speed?: string;
    onProgress?: (percent: number) => void;
}): Promise<string>;
