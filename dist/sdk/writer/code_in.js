"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareCodeIn = prepareCodeIn;
exports.codeIn = codeIn;
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const contract_1 = require("../../contract");
const constants_1 = require("../../constants");
const constants_2 = require("../constants");
const ata_1 = require("../utils/ata");
const wallet_1 = require("../utils/wallet");
const writer_utils_1 = require("./writer_utils");
const uploading_methods_1 = require("./uploading_methods");
const IDL = require("../../../idl/code_in.json");
async function prepareCodeIn(input, chunks, mode = constants_1.DEFAULT_CONTRACT_MODE, filename, method = 0, filetype = "", onProgress) {
    // Basic validation and input setup
    const totalChunks = chunks.length;
    if (totalChunks === 0) {
        throw new Error("chunks is empty");
    }
    const { connection, signer } = input;
    const wallet = (0, wallet_1.toWalletSigner)(signer);
    // Program context + PDAs
    const programId = (0, contract_1.getProgramId)(mode);
    const builder = (0, contract_1.createInstructionBuilder)(IDL, programId);
    const user = wallet.publicKey;
    const userState = (0, contract_1.getUserPda)(user, programId);
    const codeAccount = (0, contract_1.getCodeAccountPda)(user, programId);
    const userInventory = (0, contract_1.getUserInventoryPda)(user, programId);
    // Ensure user/db accounts exist
    await (0, writer_utils_1.ensureUserInitialized)(connection, signer, builder, {
        user,
        code_account: codeAccount,
        user_state: userState,
        user_inventory: userInventory,
        system_program: web3_js_1.SystemProgram.programId,
    });
    // Resolve session sequence from userState
    let seq = BigInt(0);
    const accountCoder = new anchor_1.BorshAccountsCoder(IDL);
    const info = await connection.getAccountInfo(userState);
    if (info) {
        const decoded = accountCoder.decode("UserState", info.data);
        seq = BigInt(decoded.total_session_files.toString());
    }
    // File metadata payload
    const magic = (0, writer_utils_1.readMagicBytes)(chunks[0]);
    const resolvedFiletype = filetype || magic.mime;
    const safeFilename = filename ?? `${seq}.${magic.ext}`;
    const baseMetadata = {
        filetype: resolvedFiletype,
        method,
        filename: safeFilename,
        total_chunks: totalChunks,
    };
    const inlineMetadata = totalChunks === 1
        ? JSON.stringify({ ...baseMetadata, data: chunks[0] })
        : "";
    const useInline = inlineMetadata.length > 0 &&
        Buffer.byteLength(inlineMetadata, "utf8") <= constants_2.DIRECT_METADATA_MAX_BYTES;
    const metadata = useInline ? inlineMetadata : JSON.stringify(baseMetadata);
    // Upload chunks (linked-list vs session)
    let onChainPath = "";
    const useSession = !useInline && totalChunks >= constants_2.DEFAULT_LINKED_LIST_THRESHOLD;
    let sessionAccount;
    let sessionFinalize = null;
    if (!useInline) { // useInline =  data + metadata < 900 bytes
        if (!useSession) { //useSession = data>8500 bytes
            onChainPath = await (0, uploading_methods_1.uploadLinkedList)(connection, signer, builder, user, codeAccount, chunks, method, onProgress);
        }
        else {
            onChainPath = await (0, uploading_methods_1.uploadSession)(connection, signer, builder, programId, user, userState, seq, chunks, method, { onProgress });
            sessionAccount = (0, contract_1.getSessionPda)(user, seq, programId);
            sessionFinalize = {
                seq: new anchor_1.BN(seq.toString()),
                total_chunks: totalChunks,
            };
        }
    }
    // Finalize with user_inventory_code_in (fee handled on-chain)
    const feeReceiver = new web3_js_1.PublicKey(constants_2.DEFAULT_WRITE_FEE_RECEIVER);
    const isDirectPath = !useSession && onChainPath.length === 0;
    const iqAta = isDirectPath
        ? await (0, ata_1.resolveAssociatedTokenAccount)(connection, user, new web3_js_1.PublicKey(constants_2.DEFAULT_IQ_MINT), false)
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
async function codeIn(input, chunks, mode = constants_1.DEFAULT_CONTRACT_MODE, filename, method = 0, filetype = "", onProgress) {
    const { builder, user, userInventory, onChainPath, metadata, sessionAccount, sessionFinalize, feeReceiver, iqAta, } = await prepareCodeIn(input, chunks, mode, filename, method, filetype, onProgress);
    const dbIx = (0, contract_1.userInventoryCodeInInstruction)(builder, {
        user,
        user_inventory: userInventory,
        system_program: web3_js_1.SystemProgram.programId,
        receiver: feeReceiver,
        session: sessionAccount,
        iq_ata: iqAta ?? undefined,
    }, { on_chain_path: onChainPath, metadata, session: sessionFinalize });
    const signature = await (0, writer_utils_1.sendTx)(input.connection, input.signer, dbIx);
    if (onProgress) {
        onProgress(100);
    }
    return signature;
}
