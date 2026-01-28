"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbInstructionCodeInInstruction = exports.dbCodeInInstruction = exports.walletConnectionCodeInInstruction = exports.userInitializeInstruction = exports.updateUserMetadataInstruction = exports.updateTableInstruction = exports.updateDbRootTableListInstruction = exports.setMerkleRootInstruction = exports.serverInitializeInstruction = exports.sendCodeInstruction = exports.requestConnectionInstruction = exports.postChunkInstruction = exports.manageConnectionInstruction = exports.initializeDbRootInstruction = exports.initializeConfigInstruction = exports.userInventoryCodeInForFreeInstruction = exports.userInventoryCodeInInstruction = exports.createTableInstruction = exports.createSessionInstruction = exports.createPrivateTableInstruction = exports.createExtTableInstruction = exports.createAdminTableInstruction = exports.createInstructionBuilder = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const toAccountMeta = (account, accounts, programId) => {
    const pubkey = account.address
        ? new web3_js_1.PublicKey(account.address)
        : accounts[account.name];
    if (!pubkey) {
        if (account.optional) {
            // For optional accounts, pass the program ID as a placeholder
            // This is how Anchor handles optional accounts - they expect the
            // program ID to signal "None" rather than omitting the account
            return {
                pubkey: programId,
                isSigner: false,
                isWritable: false,
            };
        }
        throw new Error(`Missing account: ${account.name}`);
    }
    return {
        pubkey,
        isSigner: Boolean(account.signer),
        isWritable: Boolean(account.writable),
    };
};
const createInstructionBuilder = (idl, programId) => {
    const coder = new anchor_1.BorshInstructionCoder(idl);
    const instructions = (idl.instructions ?? []);
    const instructionMap = new Map(instructions.map((instruction) => [instruction.name, instruction]));
    const build = (name, accounts, args) => {
        const instruction = instructionMap.get(name);
        if (!instruction) {
            throw new Error(`Unknown instruction: ${name}`);
        }
        const keys = instruction.accounts.map((account) => toAccountMeta(account, accounts, programId));
        const data = coder.encode(name, args ?? {});
        return new web3_js_1.TransactionInstruction({ programId, keys, data });
    };
    return { programId, build };
};
exports.createInstructionBuilder = createInstructionBuilder;
const createAdminTableInstruction = (builder, accounts, args) => builder.build("create_admin_table", accounts, args);
exports.createAdminTableInstruction = createAdminTableInstruction;
const createExtTableInstruction = (builder, accounts, args) => builder.build("create_ext_table", accounts, args);
exports.createExtTableInstruction = createExtTableInstruction;
const createPrivateTableInstruction = (builder, accounts, args) => builder.build("create_private_table", accounts, args);
exports.createPrivateTableInstruction = createPrivateTableInstruction;
const createSessionInstruction = (builder, accounts, args) => builder.build("create_session", accounts, args);
exports.createSessionInstruction = createSessionInstruction;
const createTableInstruction = (builder, accounts, args) => builder.build("create_table", accounts, args);
exports.createTableInstruction = createTableInstruction;
const userInventoryCodeInInstruction = (builder, accounts, args) => builder.build("user_inventory_code_in", accounts, args);
exports.userInventoryCodeInInstruction = userInventoryCodeInInstruction;
// SDK writer does not wrap this instruction yet; add a helper if needed.
const userInventoryCodeInForFreeInstruction = (builder, accounts, args) => builder.build("user_inventory_code_in_for_free", accounts, args);
exports.userInventoryCodeInForFreeInstruction = userInventoryCodeInForFreeInstruction;
const initializeConfigInstruction = (builder, accounts, args) => builder.build("initialize_config", accounts, args);
exports.initializeConfigInstruction = initializeConfigInstruction;
const initializeDbRootInstruction = (builder, accounts, args) => builder.build("initialize_db_root", accounts, args);
exports.initializeDbRootInstruction = initializeDbRootInstruction;
const manageConnectionInstruction = (builder, accounts, args) => builder.build("manage_connection", accounts, args);
exports.manageConnectionInstruction = manageConnectionInstruction;
const postChunkInstruction = (builder, accounts, args) => builder.build("post_chunk", accounts, args);
exports.postChunkInstruction = postChunkInstruction;
const requestConnectionInstruction = (builder, accounts, args) => builder.build("request_connection", accounts, args);
exports.requestConnectionInstruction = requestConnectionInstruction;
const sendCodeInstruction = (builder, accounts, args) => builder.build("send_code", accounts, args);
exports.sendCodeInstruction = sendCodeInstruction;
const serverInitializeInstruction = (builder, accounts, args) => builder.build("server_initialize", accounts, args);
exports.serverInitializeInstruction = serverInitializeInstruction;
const setMerkleRootInstruction = (builder, accounts, args) => builder.build("set_merkle_root", accounts, args);
exports.setMerkleRootInstruction = setMerkleRootInstruction;
const updateDbRootTableListInstruction = (builder, accounts, args) => builder.build("update_db_root_table_list", accounts, args);
exports.updateDbRootTableListInstruction = updateDbRootTableListInstruction;
const updateTableInstruction = (builder, accounts, args) => builder.build("update_table", accounts, args);
exports.updateTableInstruction = updateTableInstruction;
const updateUserMetadataInstruction = (builder, accounts, args) => builder.build("update_user_metadata", accounts, args);
exports.updateUserMetadataInstruction = updateUserMetadataInstruction;
const userInitializeInstruction = (builder, accounts) => builder.build("user_initialize", accounts);
exports.userInitializeInstruction = userInitializeInstruction;
// export const writeConnectionDataInstruction = (
//     builder: InstructionBuilder,
//     accounts: {
//         db_root: PublicKey;
//         connection_table: PublicKey;
//         table_ref: PublicKey;
//         signer: PublicKey;
//     },
//     args: {
//         db_root_id: Bytes;
//         connection_seed: Bytes;
//         row_json_tx: Bytes;
//     },
// ) => builder.build("write_connection_data", accounts, args);
//
// export const writeDataInstruction = (
//     builder: InstructionBuilder,
//     accounts: {
//         db_root: PublicKey;
//         table: PublicKey;
//         signer_ata?: PublicKey;
//         signer: PublicKey;
//     },
//     args: {
//         db_root_id: Bytes;
//         table_seed: Bytes;
//         row_json_tx: Bytes;
//     },
// ) => builder.build("write_data", accounts, args);
// export const databaseInstructionInstruction = (
//     builder: InstructionBuilder,
//     accounts: {
//         db_root: PublicKey;
//         table: PublicKey;
//         instruction_table: PublicKey;
//         signer_ata?: PublicKey;
//         signer: PublicKey
//     },
//     args: { db_root_id: Bytes; table_seed: Bytes; table_name: Bytes; target_tx: Bytes; content_json_tx: Bytes },
// ) => builder.build("database_instruction", accounts, args);
const walletConnectionCodeInInstruction = (builder, accounts, args) => builder.build("wallet_connection_code_in", accounts, args);
exports.walletConnectionCodeInInstruction = walletConnectionCodeInInstruction;
const dbCodeInInstruction = (builder, accounts, args) => builder.build("db_code_in", accounts, args);
exports.dbCodeInInstruction = dbCodeInInstruction;
const dbInstructionCodeInInstruction = (builder, accounts, args) => builder.build("db_instruction_code_in", accounts, args);
exports.dbInstructionCodeInInstruction = dbInstructionCodeInInstruction;
//# sourceMappingURL=instructions.js.map