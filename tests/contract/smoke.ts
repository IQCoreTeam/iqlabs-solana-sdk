import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PublicKey, Keypair } from "@solana/web3.js";
import { BN, type Idl } from "@coral-xyz/anchor";
import {
  DEFAULT_ANCHOR_PROGRAM_ID,
  createAnchorProfile,
  createPinocchioProfile,
  createInstructionBuilder,
  createSessionInstruction,
  getCodeAccountPda,
  getDbAccountPda,
  getDbRootPda,
  getSessionPda,
  getUserPda,
  userInitializeInstruction,
} from "../../src/contract";

const loadIdl = (): Idl => {
  const idlPath = path.resolve(process.cwd(), "idl", "code_in.json");
  const data = fs.readFileSync(idlPath, "utf8");
  return JSON.parse(data) as Idl;
};

const programId = new PublicKey(DEFAULT_ANCHOR_PROGRAM_ID);
const profile = createAnchorProfile(programId);
const user = Keypair.generate().publicKey;

const dbRootId = new Uint8Array([1, 2, 3, 4]);
const userState = getUserPda(profile, user);
const session = getSessionPda(profile, user, 1n);
const codeAccount = getCodeAccountPda(profile, user);
const dbAccount = getDbAccountPda(profile, user);
const dbRoot = getDbRootPda(profile, dbRootId);

assert.ok(userState instanceof PublicKey);
assert.ok(session instanceof PublicKey);
assert.ok(codeAccount instanceof PublicKey);
assert.ok(dbAccount instanceof PublicKey);
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

const userInitIx = userInitializeInstruction(builder, {
  user,
  code_account: codeAccount,
  user_state: userState,
  db_account: dbAccount,
});

assert.equal(userInitIx.programId.toBase58(), programId.toBase58());

const pinocchioId = Keypair.generate().publicKey;
const explicitPinocchio = createPinocchioProfile(pinocchioId);
assert.equal(explicitPinocchio.runtime, "pinocchio");
assert.equal(
  explicitPinocchio.programId.toBase58(),
  pinocchioId.toBase58(),
);

const defaultAnchor = createAnchorProfile();
assert.equal(defaultAnchor.runtime, "anchor");
assert.equal(
  defaultAnchor.programId.toBase58(),
  DEFAULT_ANCHOR_PROGRAM_ID,
);

console.log("contract smoke test ok");
