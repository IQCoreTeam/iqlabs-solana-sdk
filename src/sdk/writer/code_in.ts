import {BN, BorshAccountsCoder, type Idl} from "@coral-xyz/anchor";
import {Connection, PublicKey, SystemProgram} from "@solana/web3.js";

import {
    createInstructionBuilder,
    userInventoryCodeInInstruction,
    getCodeAccountPda,
    getUserInventoryPda,
    getProgramId,
    getSessionPda,
    getUserPda,
} from "../../contract";
import {DEFAULT_CONTRACT_MODE} from "../../constants";
import {
    DEFAULT_LINKED_LIST_THRESHOLD,
    DIRECT_METADATA_MAX_BYTES,
    DEFAULT_IQ_MINT,
    DEFAULT_WRITE_FEE_RECEIVER,
    CHUNK_SIZE,
} from "../constants";
import {resolveAssociatedTokenAccount} from "../utils/ata";
import {toWalletSigner, type SignerInput} from "../utils/wallet";
import {ensureUserInitialized, readMagicBytes, sendTx} from "./writer_utils";
import {uploadLinkedList, uploadSession} from "./uploading_methods";

const IDL = require("../../../idl/code_in.json") as Idl;

function toChunks(data: string | string[]): string[] {
    if (Array.isArray(data)) return data;
    if (data.length <= CHUNK_SIZE) return [data];
    const chunks: string[] = [];
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        chunks.push(data.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
}

export async function prepareCodeIn(
    input: {connection: Connection; signer: SignerInput},
    data: string | string[],
    mode: string = DEFAULT_CONTRACT_MODE,
    filename?: string,
    method = 0,
    filetype = "",
    onProgress?: (percent: number) => void,
) {
    const chunks = toChunks(data);
    const totalChunks = chunks.length;
    if (totalChunks === 0) {
        throw new Error("chunks is empty");
    }
    const {connection, signer} = input;
    const wallet = toWalletSigner(signer);

    // Program context + PDAs
    const programId = getProgramId(mode);

    const builder = createInstructionBuilder(IDL, programId);
    const user = wallet.publicKey;
    const userState = getUserPda(user, programId);
    const codeAccount = getCodeAccountPda(user, programId);
    const userInventory = getUserInventoryPda(user, programId);

    // Ensure user/db accounts exist
    await ensureUserInitialized(connection, signer, builder, {
        user,
        code_account: codeAccount,
        user_state: userState,
        user_inventory: userInventory,
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
    const baseMetadata = {
        filetype: resolvedFiletype,
        method,
        filename: safeFilename,
        total_chunks: totalChunks,
    };
    const inlineMetadata =
        totalChunks === 1
            ? JSON.stringify({...baseMetadata, data: chunks[0]})
            : "";
    const useInline =
        inlineMetadata.length > 0 &&
        Buffer.byteLength(inlineMetadata, "utf8") <= DIRECT_METADATA_MAX_BYTES;
    const metadata = useInline ? inlineMetadata : JSON.stringify(baseMetadata);

    // Upload chunks (linked-list vs session)
    let onChainPath = "";
    const useSession = !useInline && totalChunks >= DEFAULT_LINKED_LIST_THRESHOLD;
    let sessionAccount: PublicKey | undefined;
    let sessionFinalize: { seq: BN; total_chunks: number } | null = null;

    if (!useInline) { // useInline =  data + metadata < 900 bytes
        if (!useSession) { //useSession = data>8500 bytes
            onChainPath = await uploadLinkedList(
                connection,
                signer,
                builder,
                user,
                codeAccount,
                chunks,
                method,
                onProgress,
            );
        } else {
            onChainPath = await uploadSession(
                connection,
                signer,
                builder,
                programId,
                user,
                userState,
                seq,
                chunks,
                method,
                {onProgress},
            );
            sessionAccount = getSessionPda(user, seq, programId);
            sessionFinalize = {
                seq: new BN(seq.toString()),
                total_chunks: totalChunks,
            };
        }
    }

    // Finalize with user_inventory_code_in (fee handled on-chain)
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

    return {
        builder,
        user,
        userInventory,
        onChainPath,
        metadata,
        sessionAccount,
        sessionFinalize,
        feeReceiver,
        iqAta,
    };
}

export async function codeIn(
    input: {connection: Connection; signer: SignerInput},
    data: string | string[],
    mode: string = DEFAULT_CONTRACT_MODE,
    filename?: string,
    method = 0,
    filetype = "",
    onProgress?: (percent: number) => void,
) {
    const {
        builder,
        user,
        userInventory,
        onChainPath,
        metadata,
        sessionAccount,
        sessionFinalize,
        feeReceiver,
        iqAta,
    } = await prepareCodeIn(
        input,
        data,
        mode,
        filename,
        method,
        filetype,
        onProgress,
    );
    const dbIx = userInventoryCodeInInstruction(
        builder,
        {
            user,
            user_inventory: userInventory,
            system_program: SystemProgram.programId,
            receiver: feeReceiver,
            session: sessionAccount,
            iq_ata: iqAta ?? undefined,
        },
        {on_chain_path: onChainPath, metadata, session: sessionFinalize},
    );

    const signature = await sendTx(input.connection, input.signer, dbIx);
    if (onProgress) {
        onProgress(100);
    }
    return signature;
}
