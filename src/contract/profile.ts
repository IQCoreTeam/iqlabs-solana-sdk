import type { Address } from "@solana/kit";
import { CODE_IN_PROGRAM_ADDRESS } from "./generated/programs";
import {
  PINOCCHIO_INSTRUCTION_DISCRIMINATORS,
  type InstructionDiscriminators,
} from "./discriminators";

export type ContractRuntime = "anchor" | "pinocchio";

export type ProgramProfile = {
  runtime: ContractRuntime;
  programId: Address;
  instructionDiscriminators: InstructionDiscriminators;
};

export type ResolveProfileInput = {
  owner?: string | Address;
  anchorProgramId?: Address;
  pinocchioProgramId?: Address;
};

const ANCHOR_PROFILE: ProgramProfile = {
  runtime: "anchor",
  programId: CODE_IN_PROGRAM_ADDRESS,
  instructionDiscriminators: {},
};

const normalizeAddress = (value?: string) =>
  value ? value.toLowerCase() : undefined;

export function getAnchorProfile(
  programId: Address = CODE_IN_PROGRAM_ADDRESS,
): ProgramProfile {
  if (programId === ANCHOR_PROFILE.programId) {
    return ANCHOR_PROFILE;
  }
  return { ...ANCHOR_PROFILE, programId };
}

export function getPinocchioProfile(programId: Address): ProgramProfile {
  return {
    runtime: "pinocchio",
    programId,
    instructionDiscriminators: PINOCCHIO_INSTRUCTION_DISCRIMINATORS,
  };
}

export function resolveProfile({
  owner,
  anchorProgramId,
  pinocchioProgramId,
}: ResolveProfileInput = {}): ProgramProfile {
  const ownerKey = normalizeAddress(owner ? String(owner) : undefined);
  const anchorId = anchorProgramId ?? CODE_IN_PROGRAM_ADDRESS;

  if (pinocchioProgramId) {
    const pinocchioId = normalizeAddress(String(pinocchioProgramId));
    if (ownerKey && pinocchioId && ownerKey === pinocchioId) {
      return getPinocchioProfile(pinocchioProgramId);
    }
  }

  if (ownerKey && ownerKey === normalizeAddress(String(anchorId))) {
    return getAnchorProfile(anchorId);
  }

  return getAnchorProfile(anchorId);
}
