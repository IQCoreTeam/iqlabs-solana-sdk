import { BN, type Idl } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
export type Bytes = Uint8Array;
export type OptionalPubkey = PublicKey | null;
export type OptionalPubkeyList = PublicKey[] | null;
export type InstructionName = "create_admin_table" | "create_ext_table" | "create_private_table" | "create_session" | "create_table" | "database_instruction" | "db_code_in" | "db_instruction_code_in" | "wallet_connection_code_in" | "user_inventory_code_in" | "user_inventory_code_in_for_free" | "initialize_config" | "initialize_db_root" | "manage_connection" | "post_chunk" | "request_connection" | "send_code" | "server_initialize" | "set_merkle_root" | "update_db_root_table_list" | "update_table" | "update_user_metadata" | "user_initialize" | "write_connection_data" | "write_data";
export type SessionFinalize = {
    seq: BN;
    total_chunks: number;
};
export type InstructionBuilder = {
    programId: PublicKey;
    build: <TArgs extends Record<string, unknown> | undefined>(name: InstructionName, accounts: Record<string, PublicKey | undefined>, args?: TArgs) => TransactionInstruction;
};
export declare const createInstructionBuilder: (idl: Idl, programId: PublicKey) => InstructionBuilder;
export type TableCreateArgs = {
    db_root_id: Bytes;
    table_seed: Bytes;
    table_name: Bytes;
    column_names: Bytes[];
    id_col: Bytes;
    ext_keys: Bytes[];
    gate_mint_opt: OptionalPubkey;
    writers_opt: OptionalPubkeyList;
};
export type CreateAdminTableAccounts = {
    signer: PublicKey;
    db_root: PublicKey;
    table: PublicKey;
    instruction_table: PublicKey;
    system_program?: PublicKey;
};
export declare const createAdminTableInstruction: (builder: InstructionBuilder, accounts: CreateAdminTableAccounts, args: TableCreateArgs) => TransactionInstruction;
export declare const createExtTableInstruction: (builder: InstructionBuilder, accounts: CreateAdminTableAccounts, args: TableCreateArgs) => TransactionInstruction;
export declare const createPrivateTableInstruction: (builder: InstructionBuilder, accounts: CreateAdminTableAccounts, args: TableCreateArgs) => TransactionInstruction;
export declare const createSessionInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    user_state: PublicKey;
    session: PublicKey;
    system_program?: PublicKey;
}, args: {
    seq: BN;
}) => TransactionInstruction;
export declare const createTableInstruction: (builder: InstructionBuilder, accounts: {
    db_root: PublicKey;
    receiver: PublicKey;
    signer: PublicKey;
    table: PublicKey;
    instruction_table: PublicKey;
    system_program?: PublicKey;
}, args: TableCreateArgs) => TransactionInstruction;
export declare const userInventoryCodeInInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    user_inventory: PublicKey;
    system_program?: PublicKey;
    receiver: PublicKey;
    session?: PublicKey;
    iq_ata?: PublicKey;
}, args: {
    on_chain_path: string;
    metadata: string;
    session: SessionFinalize | null;
}) => TransactionInstruction;
export declare const userInventoryCodeInForFreeInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    user_inventory: PublicKey;
    config: PublicKey;
    system_program?: PublicKey;
    session?: PublicKey;
}, args: {
    on_chain_path: string;
    metadata: string;
    session: SessionFinalize | null;
    proof: Bytes[];
}) => TransactionInstruction;
export declare const initializeConfigInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    config: PublicKey;
    system_program?: PublicKey;
}, args: {
    merkle_root: Bytes;
}) => TransactionInstruction;
export declare const initializeDbRootInstruction: (builder: InstructionBuilder, accounts: {
    db_root: PublicKey;
    signer: PublicKey;
    system_program?: PublicKey;
}, args: {
    db_root_id: Bytes;
}) => TransactionInstruction;
export declare const manageConnectionInstruction: (builder: InstructionBuilder, accounts: {
    db_root: PublicKey;
    connection_table: PublicKey;
    signer: PublicKey;
}, args: {
    db_root_id: Bytes;
    connection_seed: Bytes;
    new_status: number;
}) => TransactionInstruction;
export declare const postChunkInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    session: PublicKey;
}, args: {
    index: number;
    chunk: string;
    method: number;
    decode_break: number;
}) => TransactionInstruction;
export declare const requestConnectionInstruction: (builder: InstructionBuilder, accounts: {
    requester: PublicKey;
    db_root: PublicKey;
    connection_table: PublicKey;
    instruction_table: PublicKey;
    requester_user: PublicKey;
    receiver_user: PublicKey;
    table_ref: PublicKey;
    target_table_ref: PublicKey;
    system_program?: PublicKey;
}, args: {
    db_root_id: Bytes;
    connection_seed: Bytes;
    receiver: PublicKey;
    table_name: Bytes;
    column_names: Bytes[];
    id_col: Bytes;
    ext_keys: Bytes[];
    user_payload: Bytes;
}) => TransactionInstruction;
export declare const sendCodeInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    code_account: PublicKey;
    system_program?: PublicKey;
}, args: {
    code: string;
    before_tx: string;
    method: number;
    decode_break: number;
}) => TransactionInstruction;
export declare const serverInitializeInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    server_account: PublicKey;
    system_program?: PublicKey;
}, args: {
    server_id: string;
    server_type: string;
    allowed_merkle_root: string;
}) => TransactionInstruction;
export declare const setMerkleRootInstruction: (builder: InstructionBuilder, accounts: {
    authority: PublicKey;
    config: PublicKey;
}, args: {
    new_root: Bytes;
    new_authority: OptionalPubkey;
}) => TransactionInstruction;
export declare const updateDbRootTableListInstruction: (builder: InstructionBuilder, accounts: {
    db_root: PublicKey;
    signer: PublicKey;
}, args: {
    db_root_id: Bytes;
    new_table_seeds: Bytes[];
}) => TransactionInstruction;
export declare const updateTableInstruction: (builder: InstructionBuilder, accounts: {
    db_root: PublicKey;
    table: PublicKey;
    signer: PublicKey;
}, args: {
    db_root_id: Bytes;
    table_seed: Bytes;
    table_name: Bytes;
    column_names: Bytes[];
    id_col: Bytes;
    ext_keys: Bytes[];
    writers_opt: OptionalPubkeyList;
}) => TransactionInstruction;
export declare const updateUserMetadataInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    db_root: PublicKey;
    signer: PublicKey;
    system_program?: PublicKey;
}, args: {
    db_root_id: Bytes;
    meta: Bytes;
}) => TransactionInstruction;
export declare const userInitializeInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    code_account: PublicKey;
    user_state: PublicKey;
    user_inventory: PublicKey;
    system_program?: PublicKey;
}) => TransactionInstruction;
export declare const walletConnectionCodeInInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    signer?: PublicKey;
    user_inventory: PublicKey;
    db_root: PublicKey;
    connection_table: PublicKey;
    table_ref: PublicKey;
    system_program?: PublicKey;
    receiver: PublicKey;
    session?: PublicKey;
    iq_ata?: PublicKey;
}, args: {
    db_root_id: Bytes;
    connection_seed: Bytes;
    on_chain_path: string;
    metadata: string;
    session: SessionFinalize | null;
}) => TransactionInstruction;
export declare const dbCodeInInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    signer?: PublicKey;
    user_inventory: PublicKey;
    db_root: PublicKey;
    table: PublicKey;
    signer_ata?: PublicKey;
    system_program?: PublicKey;
    receiver: PublicKey;
    session?: PublicKey;
    iq_ata?: PublicKey;
}, args: {
    db_root_id: Bytes;
    table_seed: Bytes;
    on_chain_path: string;
    metadata: string;
    session: SessionFinalize | null;
}) => TransactionInstruction;
export declare const dbInstructionCodeInInstruction: (builder: InstructionBuilder, accounts: {
    user: PublicKey;
    signer?: PublicKey;
    user_inventory: PublicKey;
    db_root: PublicKey;
    table: PublicKey;
    instruction_table: PublicKey;
    signer_ata?: PublicKey;
    system_program?: PublicKey;
    receiver: PublicKey;
    session?: PublicKey;
    iq_ata?: PublicKey;
}, args: {
    db_root_id: Bytes;
    table_seed: Bytes;
    table_name: Bytes;
    target_tx: Bytes;
    on_chain_path: string;
    metadata: string;
    session: SessionFinalize | null;
}) => TransactionInstruction;
