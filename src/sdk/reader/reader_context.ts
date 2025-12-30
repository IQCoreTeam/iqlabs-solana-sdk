import {BorshAccountsCoder, BorshInstructionCoder, type Idl} from "@coral-xyz/anchor";
import {PublicKey} from "@solana/web3.js";

import {
    createAnchorProfile,
    createPinocchioProfile,
    DEFAULT_PINOCCHIO_PROGRAM_ID,
} from "../../contract";

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
