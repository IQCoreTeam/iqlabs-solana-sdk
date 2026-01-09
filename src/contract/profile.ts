import {PublicKey} from "@solana/web3.js";

import {DEFAULT_CONTRACT_MODE} from "../constants";
import {
    DEFAULT_ANCHOR_PROGRAM_ID,
    DEFAULT_PINOCCHIO_PROGRAM_ID,
} from "./constants";

const DEFAULT_PROGRAM_IDS: Record<"anchor" | "pinocchio", PublicKey> = {
    anchor: new PublicKey(DEFAULT_ANCHOR_PROGRAM_ID),
    pinocchio: new PublicKey(DEFAULT_PINOCCHIO_PROGRAM_ID),
};

export const resolveContractRuntime = (
    mode: string = DEFAULT_CONTRACT_MODE,
): "anchor" | "pinocchio" =>
    mode === "pinocchio" ? "pinocchio" : "anchor";

export const getProgramId = (
    mode: string = DEFAULT_CONTRACT_MODE,
): PublicKey => DEFAULT_PROGRAM_IDS[resolveContractRuntime(mode)];
