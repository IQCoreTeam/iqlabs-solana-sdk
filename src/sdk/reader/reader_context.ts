import {
    BorshAccountsCoder,
    BorshInstructionCoder,
    type Idl,
} from "@coral-xyz/anchor";
import {PublicKey, type VersionedTransactionResponse} from "@solana/web3.js";

import {
    DEFAULT_ANCHOR_PROGRAM_ID,
    DEFAULT_PINOCCHIO_PROGRAM_ID,
    resolveContractRuntime,
} from "../../contract";
import {DEFAULT_CONTRACT_MODE} from "../../constants";
import IDL_JSON from "../../../idl/code_in.json";

const IDL = IDL_JSON as unknown as Idl;

export const readerContext = {
    idl: IDL,
    instructionCoder: new BorshInstructionCoder(IDL),
    accountCoder: new BorshAccountsCoder(IDL),
    anchorProgramId: new PublicKey(DEFAULT_ANCHOR_PROGRAM_ID),
    pinocchioProgramId: new PublicKey(DEFAULT_PINOCCHIO_PROGRAM_ID),
} as const;

export const resolveReaderProgramId = (
    mode: string = DEFAULT_CONTRACT_MODE,
) => {
    const runtime = resolveContractRuntime(mode);
    return runtime === "anchor"
        ? readerContext.anchorProgramId
        : readerContext.pinocchioProgramId;
};

export const resolveReaderModeFromTx = (
    tx: VersionedTransactionResponse,
): "anchor" | "pinocchio" => {
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
        if (programId.equals(readerContext.anchorProgramId)) {
            sawAnchor = true;
        }
        if (programId.equals(readerContext.pinocchioProgramId)) {
            sawPinocchio = true;
        }
    }

    if (sawAnchor && !sawPinocchio) {
        return "anchor";
    }
    if (sawPinocchio && !sawAnchor) {
        return "pinocchio";
    }

    return resolveContractRuntime(DEFAULT_CONTRACT_MODE);
};
