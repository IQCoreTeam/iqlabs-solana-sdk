import {BN, BorshAccountsCoder, type Idl} from "@coral-xyz/anchor";
import {Connection, PublicKey, SystemProgram} from "@solana/web3.js";

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
    DIRECT_METADATA_MAX_BYTES,
    DEFAULT_IQ_MINT,
    DEFAULT_LINKED_LIST_THRESHOLD,
    DEFAULT_WRITE_FEE_RECEIVER,
} from "../constants";
import {DEFAULT_PINOCCHIO_PROGRAM_ID} from "../../contract/constants";
import {resolveAssociatedTokenAccount} from "../utils/ata";
import {readMagicBytes} from "../utils/magic_bytes";
import {DEFAULT_SESSION_SPEED} from "../utils/session_speed";
import {toWalletSigner, type SignerInput} from "../utils/wallet";
import {ensureUserInitialized, sendTx} from "./writer_utils";
import {uploadLinkedList, uploadSession} from "./uploading_methods";

const IDL = require("../../../idl/code_in.json") as Idl;
const IQ_MINT = new PublicKey(DEFAULT_IQ_MINT);

export async function codein(
    input: {connection: Connection; signer: SignerInput},
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
    const wallet = toWalletSigner(signer);

    // Program context + PDAs
    const profile =
        isAnchor
            ? createAnchorProfile()
            : createPinocchioProfile(
                  new PublicKey(DEFAULT_PINOCCHIO_PROGRAM_ID),
              );
    const builder = createInstructionBuilder(IDL, profile.programId);
    const user = wallet.publicKey;
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

    // Resolve session sequence from userState
    let seq = BigInt(0);
    const accountCoder = new BorshAccountsCoder(IDL);
    const info = await connection.getAccountInfo(userState);
    if (info) {
        const decoded = accountCoder.decode("UserState", info.data) as {
            total_session_files: BN;
        };
        seq = BigInt(decoded.total_session_files.toString());
    }

    // File metadata payload
    const magic = readMagicBytes(chunks[0]);
    const resolvedFiletype = filetype || magic.mime;
    const safeFilename = filename ?? `${seq}.${magic.ext}`;
    const metadataPayload = {
        filetype: resolvedFiletype,
        method,
        filename: safeFilename,
        total_chunks: totalChunks,
    };
    const dataPayload = chunks.join("");
    const directMetadata = JSON.stringify({
        ...metadataPayload,
        data: dataPayload,
    });
    const useDirectPath =
        Buffer.byteLength(directMetadata, "utf8") <= DIRECT_METADATA_MAX_BYTES;

    // Upload chunks (linked-list vs session)
    let onChainPath = "";
    let metadata = directMetadata;
    let useSession = false;
    if (!useDirectPath) {
        metadata = JSON.stringify(metadataPayload);
        useSession = totalChunks >= DEFAULT_LINKED_LIST_THRESHOLD;
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
    }

    // Finalize with db_code_in (fees are handled by the program)
    const feeReceiver = new PublicKey(DEFAULT_WRITE_FEE_RECEIVER);
    const sessionAccount = useSession ? new PublicKey(onChainPath) : null;
    const sessionFinalize = useSession
        ? {
              seq: new BN(seq.toString()),
              total_chunks: totalChunks,
          }
        : null;
    let iqAtaAccount: PublicKey | null | undefined;
    if (useDirectPath) {
        iqAtaAccount = await resolveAssociatedTokenAccount(
            connection,
            user,
            IQ_MINT,
            false,
        );
    }
    const dbIx = dbCodeInInstruction(
        builder,
        {
            user,
            db_account: dbAccount,
            receiver: feeReceiver,
            system_program: SystemProgram.programId,
            session: sessionAccount ?? undefined,
            iq_ata: iqAtaAccount ?? undefined,
        },
        {on_chain_path: onChainPath, metadata, session: sessionFinalize},
    );

    return sendTx(connection, signer, dbIx);
}
