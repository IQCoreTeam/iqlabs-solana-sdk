import { PublicKey } from "@solana/web3.js";
import { DEFAULT_ANCHOR_PROGRAM_ID } from "./constants";

export type ContractRuntime = "anchor" | "pinocchio";

export type ProgramProfile = {
  runtime: ContractRuntime;
  programId: PublicKey;
};

export const DEFAULT_ANCHOR_PROGRAM_KEY = new PublicKey(
  DEFAULT_ANCHOR_PROGRAM_ID,
);

export const createAnchorProfile = (
  programId: PublicKey = DEFAULT_ANCHOR_PROGRAM_KEY,
): ProgramProfile => ({
  runtime: "anchor",
  programId,
});

export const createPinocchioProfile = (
  programId: PublicKey,
): ProgramProfile => ({
  runtime: "pinocchio",
  programId,
});
