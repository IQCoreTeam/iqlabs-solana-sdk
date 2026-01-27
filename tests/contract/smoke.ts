import assert from "node:assert/strict";
import {PublicKey, Keypair} from "@solana/web3.js";
import BN from "bn.js";
import {
    DEFAULT_ANCHOR_PROGRAM_ID,
    DEFAULT_PINOCCHIO_PROGRAM_ID,
    CODE_IN_IDL,
    createInstructionBuilder,
    createSessionInstruction,
    getCodeAccountPda,
    getDbRootPda,
    getProgramId,
    getSessionPda,
    getUserInventoryPda,
    getUserPda,
    resolveContractRuntime,
    userInitializeInstruction,
} from "@iqlabs/solana-sdk";

const programId = new PublicKey(DEFAULT_ANCHOR_PROGRAM_ID);
const user = Keypair.generate().publicKey;

const dbRootId = new Uint8Array([1, 2, 3, 4]);
const userState = getUserPda(user, programId);
const session = getSessionPda(user, 1n, programId);
const codeAccount = getCodeAccountPda(user, programId);
const userInventory = getUserInventoryPda(user, programId);
const dbRoot = getDbRootPda(dbRootId, programId);

assert.ok(userState instanceof PublicKey);
assert.ok(session instanceof PublicKey);
assert.ok(codeAccount instanceof PublicKey);
assert.ok(userInventory instanceof PublicKey);
assert.ok(dbRoot instanceof PublicKey);

const builder = createInstructionBuilder(CODE_IN_IDL, programId);

const createSessionIx = createSessionInstruction(
  builder,
  {
    user,
    user_state: userState,
    session,
  },
  { seq: new BN(1) },
);

assert.equal(createSessionIx.programId.toBase58(), programId.toBase58());
assert.equal(createSessionIx.keys.length, 4);
assert.ok(createSessionIx.data.length > 0);

const userInitIx = userInitializeInstruction(builder, {
  user,
  code_account: codeAccount,
  user_state: userState,
  user_inventory: userInventory,
});

assert.equal(userInitIx.programId.toBase58(), programId.toBase58());

const pinocchioRuntime = resolveContractRuntime("pinocchio");
assert.equal(pinocchioRuntime, "pinocchio");
const inferredAnchor = resolveContractRuntime("anything_else");
assert.equal(inferredAnchor, "anchor");

const defaultAnchorProgram = getProgramId("anchor");
assert.equal(defaultAnchorProgram.toBase58(), DEFAULT_ANCHOR_PROGRAM_ID);
const defaultPinocchioProgram = getProgramId("pinocchio");
assert.equal(defaultPinocchioProgram.toBase58(), DEFAULT_PINOCCHIO_PROGRAM_ID);

const customProgramId = Keypair.generate().publicKey;
const customUserState = getUserPda(user, customProgramId);
assert.ok(customUserState instanceof PublicKey);

console.log("contract smoke test ok");
