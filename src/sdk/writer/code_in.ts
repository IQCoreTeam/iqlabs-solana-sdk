import {BN, BorshAccountsCoder, type Idl} from "@coral-xyz/anchor";
import {
    Connection,
    PublicKey,
    SystemProgram,
    type Signer,
} from "@solana/web3.js";

import {
    createAnchorProfile,
    createInstructionBuilder,
    createPinocchioProfile,
    dbCodeInInstruction,
    getCodeAccountPda,
    getDbAccountPda,
    getUserPda,
} from "../../contract";
import {
    DEFAULT_LINKED_LIST_THRESHOLD,
    DEFAULT_SESSION_WRITE_FEE_LAMPORTS,
    DEFAULT_WRITE_FEE_LAMPORTS,
    DEFAULT_WRITE_FEE_RECEIVER,
} from "../constants";
import {DEFAULT_PINOCCHIO_PROGRAM_ID} from "../../contract/constants";
import {readMagicBytes} from "../utils/magic_bytes";
import {DEFAULT_SESSION_SPEED} from "../utils/session_speed";
import {ensureUserInitialized, sendTx} from "./writer_utils";
import {uploadLinkedList, uploadSession} from "./uploading_methods";

const IDL = require("../../../idl/code_in.json") as Idl;

export async function codein(
    input: { connection: Connection; signer: Signer },
    chunks: string[],
    isAnchor = false,
    filename?: string,
    method = 0,
    filetype = "",
    speed: string = DEFAULT_SESSION_SPEED,
) {
    // Basic validation and input setup
    const totalChunks = chunks.length;
    if (totalChunks === 0) {
        throw new Error("chunks is empty");
    }
    const {connection, signer} = input;

    // Program context + PDAs
    const profile =
        isAnchor
            ? createAnchorProfile()
            : createPinocchioProfile(
                  new PublicKey(DEFAULT_PINOCCHIO_PROGRAM_ID),
              );
    const builder = createInstructionBuilder(IDL, profile.programId);
    const user = signer.publicKey;
    const userState = getUserPda(profile, user);
    const codeAccount = getCodeAccountPda(profile, user);
    const dbAccount = getDbAccountPda(profile, user);

    // Ensure user/db accounts exist
    await ensureUserInitialized(connection, signer, builder, {
        user,
        code_account: codeAccount,
        user_state: userState,
        db_account: dbAccount,
        system_program: SystemProgram.programId,
    });

    // Anchor flow: resolve session sequence
    let seq = BigInt(0);
    if (isAnchor) {
        const accountCoder = new BorshAccountsCoder(IDL);
        const info = await connection.getAccountInfo(userState);
        if (info) {
            const decoded = accountCoder.decode("UserState", info.data) as {
                total_session_files: BN;
            };
            seq = BigInt(decoded.total_session_files.toString());
        }
    }

    // File metadata payload
    const magic = readMagicBytes(chunks[0]);
    const resolvedFiletype = filetype || magic.mime;
    const safeFilename = filename ?? `${seq}.${magic.ext}`;
    const metadata = JSON.stringify({
        filetype: resolvedFiletype,
        method,
        filename: safeFilename,
        total_chunks: totalChunks,
    });

    // Upload chunks (linked-list vs session)
    let onChainPath = "";
    const useSession = totalChunks >= DEFAULT_LINKED_LIST_THRESHOLD;
    if (!useSession) {
        onChainPath = await uploadLinkedList(
            connection,
            signer,
            builder,
            user,
            codeAccount,
            chunks,
            method,
        );
    } else {
        onChainPath = await uploadSession(
            connection,
            signer,
            builder,
            profile,
            user,
            userState,
            seq,
            chunks,
            method,
            {
                speed,
            },
        );
    }

    // Finalize with fee transfer + db_code_in
    const feeReceiver = new PublicKey(DEFAULT_WRITE_FEE_RECEIVER);
    const linkedListFeeLamports = DEFAULT_WRITE_FEE_LAMPORTS;
    const sessionFeeLamports = DEFAULT_SESSION_WRITE_FEE_LAMPORTS;
    const feeLamports = useSession ? sessionFeeLamports : linkedListFeeLamports;
    const sessionAccount = useSession ? new PublicKey(onChainPath) : null;
    const sessionFinalize = useSession
        ? {
              seq: new BN(seq.toString()),
              total_chunks: totalChunks,
          }
        : null;
    const feeIx = SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: dbAccount,
        lamports: feeLamports,
    });
    const dbIx = dbCodeInInstruction(
        builder,
        {
            user,
            db_account: dbAccount,
            system_program: SystemProgram.programId,
            session: sessionAccount ?? undefined,
        },
        {on_chain_path: onChainPath, metadata, session: sessionFinalize},
    );
    dbIx.keys.push({
        pubkey: feeReceiver,
        isSigner: false,
        isWritable: true,
    });

    return sendTx(connection, signer, [feeIx, dbIx]);
}
