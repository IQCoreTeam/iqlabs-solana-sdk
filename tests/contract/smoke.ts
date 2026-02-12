import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {PublicKey, Keypair} from "@solana/web3.js";
import {BN, type Idl} from "@coral-xyz/anchor";
import {
    DEFAULT_ANCHOR_PROGRAM_ID,
    createInstructionBuilder,
    createSessionInstruction,
    getCodeAccountPda,
    getDbRootPda,
    PROGRAM_ID,
    getSessionPda,
    getUserPda,
    getUserInventoryPda,
    userInitializeInstruction,
} from "../../src/contract";

const loadIdl = (): Idl => {
  const idlPath = path.resolve(process.cwd(), "idl", "code_in.json");
  const data = fs.readFileSync(idlPath, "utf8");
  return JSON.parse(data) as Idl;
};

const programId = new PublicKey(DEFAULT_ANCHOR_PROGRAM_ID);
const user = Keypair.generate().publicKey;

const dbRootId = new Uint8Array([1, 2, 3, 4]);
const userState = getUserPda(user, programId);
const session = getSessionPda(user, 1n, programId);
const codeAccount = getCodeAccountPda(user, programId);
const dbRoot = getDbRootPda(dbRootId, programId);

assert.ok(userState instanceof PublicKey);
assert.ok(session instanceof PublicKey);
assert.ok(codeAccount instanceof PublicKey);
assert.ok(dbRoot instanceof PublicKey);

const idl = loadIdl();
const builder = createInstructionBuilder(idl, programId);

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

const userInventory = getUserInventoryPda(user, programId);
const userInitIx = userInitializeInstruction(builder, {
  user,
  code_account: codeAccount,
  user_state: userState,
  user_inventory: userInventory,
});

assert.equal(userInitIx.programId.toBase58(), programId.toBase58());

assert.equal(PROGRAM_ID.toBase58(), DEFAULT_ANCHOR_PROGRAM_ID);

const customProgramId = Keypair.generate().publicKey;
const customUserState = getUserPda(user, customProgramId);
assert.ok(customUserState instanceof PublicKey);

console.log("contract smoke test ok");
