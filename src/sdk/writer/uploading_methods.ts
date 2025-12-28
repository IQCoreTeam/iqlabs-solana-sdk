import {BN} from "@coral-xyz/anchor";
import {
    Connection,
    SystemProgram,
    type PublicKey,
    type Signer,
} from "@solana/web3.js";
import {
    createSessionInstruction,
    getSessionPda,
    postChunkInstruction,
    sendCodeInstruction,
    type InstructionBuilder,
    type ProgramProfile,
} from "../../contract";
import {sendTx} from "./writer_utils";

export async function uploadLinkedList(
  connection: Connection,
  signer: Signer,
  builder: InstructionBuilder,
  user: PublicKey,
  codeAccount: PublicKey,
  chunks: string[],
  method: number,
) {
  let beforeTx = "Genesis";
  for (const chunk of chunks) {
    const ix = sendCodeInstruction(
            builder,
            {
                user,
                code_account: codeAccount,
                system_program: SystemProgram.programId,
            },
            {
                code: chunk,
                before_tx: beforeTx,
                method,
                decode_break: 0,
            },
        );
        beforeTx = await sendTx(connection, signer, ix);
    }
  return beforeTx;
}

export async function uploadSession(
  connection: Connection,
  signer: Signer,
  builder: InstructionBuilder,
  profile: ProgramProfile,
  user: PublicKey,
  userState: PublicKey,
  seq: bigint,
  chunks: string[],
  method: number,
) {
  const session = getSessionPda(profile, user, seq);
    const sessionInfo = await connection.getAccountInfo(session);
    if (!sessionInfo) {
        const createIx = createSessionInstruction(
            builder,
            {
                user,
                user_state: userState,
                session,
                system_program: SystemProgram.programId,
            },
            {seq: new BN(seq.toString())},
        );
        await sendTx(connection, signer, createIx);
    }

    for (let index = 0; index < chunks.length; index += 1) {
        const ix = postChunkInstruction(
            builder,
            {user, session},
            {
                seq: new BN(seq.toString()),
                index,
                chunk: chunks[index],
                method,
                decode_break: 0,
            },
        );
        await sendTx(connection, signer, ix);
    }

    return session.toBase58();
}
