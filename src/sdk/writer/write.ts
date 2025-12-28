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
    createSessionInstruction,
    dbCodeInInstruction,
    getCodeAccountPda,
    getDbAccountPda,
    getSessionPda,
    getUserPda,
    postChunkInstruction,
    sendCodeInstruction,
    userInitializeInstruction,
} from "../../contract";
import {
    DEFAULT_LINKED_LIST_THRESHOLD,
    DEFAULT_WRITE_FEE_LAMPORTS,
    DEFAULT_WRITE_FEE_RECEIVER,
} from "../constants";
import {readMagicBytes} from "../utils/magic_bytes";
import {sendTx} from "./writer_utils";

const IDL = require("../../../idl/code_in.json") as Idl;

export async function write(
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
    const dbInfo = await connection.getAccountInfo(dbAccount);
    if (!dbInfo) {
        const initIx = userInitializeInstruction(builder, {
            user,
            code_account: codeAccount,
            user_state: userState,
            db_account: dbAccount,
            system_program: SystemProgram.programId,
        });
        await sendTx(connection, signer, initIx);
    }

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

    if (totalChunks < DEFAULT_LINKED_LIST_THRESHOLD) {
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
        onChainPath = beforeTx;
    } else {
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

        for (let index = 0; index < totalChunks; index += 1) {
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
        onChainPath = session.toBase58();
    }

    // Finalize with fee transfer + db_code_in
    const feeReceiver = new PublicKey(DEFAULT_WRITE_FEE_RECEIVER);
    const feeIx = SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: dbAccount,
        lamports: DEFAULT_WRITE_FEE_LAMPORTS,
    });
    const dbIx = dbCodeInInstruction(
        builder,
        {user, db_account: dbAccount, system_program: SystemProgram.programId},
        {on_chain_path: onChainPath, metadata, session: null},
    );
    dbIx.keys.push({
        pubkey: feeReceiver,
        isSigner: false,
        isWritable: true,
    });

    return sendTx(connection, signer, [feeIx, dbIx]);
}
