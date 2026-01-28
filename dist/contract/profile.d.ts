import { PublicKey } from "@solana/web3.js";
export declare const resolveContractRuntime: (mode?: string) => "anchor" | "pinocchio";
export declare const getProgramId: (mode?: string) => PublicKey;
