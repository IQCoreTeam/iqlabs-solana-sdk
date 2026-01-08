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
    dbCodeInInstruction,
    getCodeAccountPda,
    getDbAccountPda,
    getSessionPda,
    getUserPda,
} from "../../contract";
import {
    DEFAULT_LINKED_LIST_THRESHOLD,
    DEFAULT_IQ_MINT,
    DEFAULT_WRITE_FEE_RECEIVER,
} from "../constants";
import {resolveAssociatedTokenAccount} from "../utils/ata";
import {readMagicBytes} from "../utils/magic_bytes";
import {ensureUserInitialized, sendTx} from "./writer_utils";
import {uploadLinkedList, uploadSession} from "./uploading_methods";

const IDL = require("../../../idl/code_in.json") as Idl;


export async function codein(
    input: { connection: Connection; signer: Signer },
    chunks: string[],
    isAnchor = true,
    filename?: string,
    method = 0,
    filetype = "",
) {
    // Basic validation and input setup
    const totalChunks = chunks.length;
    if (totalChunks === 0) {
        throw new Error("chunks is empty");
    }
    const {connection, signer} = input;

    // Program context + PDAs
    const profile = createAnchorProfile();
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
    let sessionAccount: PublicKey | undefined;
    let sessionFinalize: { seq: BN; total_chunks: number } | null = null;

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
        );
        sessionAccount = getSessionPda(profile, user, seq);
        sessionFinalize = {
            seq: new BN(seq.toString()),
            total_chunks: totalChunks,
        };
    }

    // Finalize with db_code_in (fee handled on-chain)
    const feeReceiver = new PublicKey(DEFAULT_WRITE_FEE_RECEIVER);
    const isDirectPath = !useSession && onChainPath.length === 0;
    const iqAta = isDirectPath
        ? await resolveAssociatedTokenAccount(
              connection,
              user,
              new PublicKey(DEFAULT_IQ_MINT),
              false,
          )
        : null;
    const dbIx = dbCodeInInstruction(
        builder,
        {
            user,
            db_account: dbAccount,
            system_program: SystemProgram.programId,
            receiver: feeReceiver,
            session: sessionAccount,
            iq_ata: iqAta ?? undefined,
        },
        {on_chain_path: onChainPath, metadata, session: sessionFinalize},
    );

    return sendTx(connection, signer, dbIx);
}
