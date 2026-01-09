import {BorshAccountsCoder, BorshInstructionCoder, type Idl} from "@coral-xyz/anchor";
import {PublicKey, type VersionedTransactionResponse} from "@solana/web3.js";

import {
    createAnchorProfile,
    createPinocchioProfile,
    DEFAULT_PINOCCHIO_PROGRAM_ID,
} from "../../contract";
import {DEFAULT_CONTRACT_MODE} from "../constants";

const IDL = require("../../../idl/code_in.json") as Idl;

export const readerContext = {
    idl: IDL,
    instructionCoder: new BorshInstructionCoder(IDL),
    accountCoder: new BorshAccountsCoder(IDL),
    anchorProfile: createAnchorProfile(),
    pinocchioProfile: createPinocchioProfile(
        new PublicKey(DEFAULT_PINOCCHIO_PROGRAM_ID),
    ),
} as const;

export const resolveReaderProfile = (mode: string = DEFAULT_CONTRACT_MODE) => {
    const resolvedMode =
        mode === "anchor" || mode === "pinocchio" ? mode : DEFAULT_CONTRACT_MODE;
    return resolvedMode === "anchor"
        ? readerContext.anchorProfile
        : readerContext.pinocchioProfile;
};

export const resolveReaderModeFromTx = (
    tx: VersionedTransactionResponse,
    mode: string = DEFAULT_CONTRACT_MODE,
) => {
    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys(
        tx.meta?.loadedAddresses
            ? {accountKeysFromLookups: tx.meta.loadedAddresses}
            : undefined,
    );
    let sawAnchor = false;
    let sawPinocchio = false;

    for (const ix of message.compiledInstructions) {
        const programId = accountKeys.get(ix.programIdIndex);
        if (!programId) {
            continue;
        }
        if (programId.equals(readerContext.anchorProfile.programId)) {
            sawAnchor = true;
        }
        if (programId.equals(readerContext.pinocchioProfile.programId)) {
            sawPinocchio = true;
        }
    }

    if (sawAnchor && !sawPinocchio) {
        return "anchor";
    }
    if (sawPinocchio && !sawAnchor) {
        return "pinocchio";
    }

    return mode === "anchor" || mode === "pinocchio"
        ? mode
        : DEFAULT_CONTRACT_MODE;
};
