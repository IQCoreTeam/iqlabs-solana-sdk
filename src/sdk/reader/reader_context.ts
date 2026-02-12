import {
    BorshAccountsCoder,
    BorshInstructionCoder,
    type Idl,
} from "@coral-xyz/anchor";
import {PublicKey} from "@solana/web3.js";

import {DEFAULT_ANCHOR_PROGRAM_ID} from "../../contract";

const IDL = require("../../../idl/code_in.json") as Idl;

export const readerContext = {
    idl: IDL,
    instructionCoder: new BorshInstructionCoder(IDL),
    accountCoder: new BorshAccountsCoder(IDL),
    anchorProgramId: new PublicKey(DEFAULT_ANCHOR_PROGRAM_ID),
} as const;
