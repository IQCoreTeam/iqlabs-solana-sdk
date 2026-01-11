import {BN, BorshInstructionCoder, type Idl} from "@coral-xyz/anchor";
import {
    PublicKey,
    TransactionInstruction,
    type AccountMeta,
} from "@solana/web3.js";

export type Bytes = Uint8Array;
export type OptionalPubkey = PublicKey | null;
export type OptionalPubkeyList = PublicKey[] | null;

export type InstructionName =
    | "create_admin_table"
    | "create_ext_table"
    | "create_private_table"
    | "create_session"
    | "create_table"
    | "database_instruction"
    | "db_code_in"
    | "db_instruction_code_in"
    | "wallet_connection_code_in"
    | "user_inventory_code_in"
    | "user_inventory_code_in_for_free"
    | "initialize_config"
    | "initialize_db_root"
    | "manage_connection"
    | "post_chunk"
    | "request_connection"
    | "send_code"
    | "server_initialize"
    | "set_merkle_root"
    | "update_db_root_table_list"
    | "update_table"
    | "update_user_metadata"
    | "user_initialize"
    | "write_connection_data"
    | "write_data";

export type SessionFinalize = {
    seq: BN;
    total_chunks: number;
};

type IdlAccount = {
    name: string;
    writable?: boolean;
    signer?: boolean;
    address?: string;
    optional?: boolean;
};

type IdlInstruction = {
    name: string;
    accounts: IdlAccount[];
};

export type InstructionBuilder = {
    programId: PublicKey;
    build: <TArgs extends Record<string, unknown> | undefined>(
        name: InstructionName,
        accounts: Record<string, PublicKey | undefined>,
        args?: TArgs,
    ) => TransactionInstruction;
};

const toAccountMeta = (
    account: IdlAccount,
    accounts: Record<string, PublicKey | undefined>,
    programId: PublicKey,
): AccountMeta => {
    const pubkey = account.address
        ? new PublicKey(account.address)
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

export const createInstructionBuilder = (
    idl: Idl,
    programId: PublicKey,
): InstructionBuilder => {
    const coder = new BorshInstructionCoder(idl);
    const instructions = (idl.instructions ?? []) as IdlInstruction[];
    const instructionMap = new Map<string, IdlInstruction>(
        instructions.map((instruction) => [instruction.name, instruction]),
    );

    const build: InstructionBuilder["build"] = (name, accounts, args) => {
        const instruction = instructionMap.get(name);
        if (!instruction) {
            throw new Error(`Unknown instruction: ${name}`);
        }

        const keys = instruction.accounts.map((account) =>
            toAccountMeta(account, accounts, programId),
        );
        const data = coder.encode(name, args ?? {});

        return new TransactionInstruction({programId, keys, data});
    };

    return {programId, build};
};

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

export const createAdminTableInstruction = (
    builder: InstructionBuilder,
    accounts: CreateAdminTableAccounts,
    args: TableCreateArgs,
) => builder.build("create_admin_table", accounts, args);

export const createExtTableInstruction = (
    builder: InstructionBuilder,
    accounts: CreateAdminTableAccounts,
    args: TableCreateArgs,
) => builder.build("create_ext_table", accounts, args);

export const createPrivateTableInstruction = (
    builder: InstructionBuilder,
    accounts: CreateAdminTableAccounts,
    args: TableCreateArgs,
) => builder.build("create_private_table", accounts, args);

export const createSessionInstruction = (
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        user_state: PublicKey;
        session: PublicKey;
        system_program?: PublicKey;
    },
    args: {
        seq: BN;
    },
) => builder.build("create_session", accounts, args);

export const createTableInstruction = (
    builder: InstructionBuilder,
    accounts: {
        db_root: PublicKey;
        receiver: PublicKey;
        signer: PublicKey;
        table: PublicKey;
        instruction_table: PublicKey;
        system_program?: PublicKey;
    },
    args: TableCreateArgs,
) => builder.build("create_table", accounts, args);


export const userInventoryCodeInInstruction = (
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        user_inventory: PublicKey;
        system_program?: PublicKey;
        receiver: PublicKey;
        session?: PublicKey;
        iq_ata?: PublicKey;
    },
    args: {
        on_chain_path: string;
        metadata: string;
        session: SessionFinalize | null;
    },
) => builder.build("user_inventory_code_in", accounts, args);

// SDK writer does not wrap this instruction yet; add a helper if needed.
export const userInventoryCodeInForFreeInstruction = (
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        user_inventory: PublicKey;
        config: PublicKey;
        system_program?: PublicKey;
        session?: PublicKey;
    },
    args: {
        on_chain_path: string;
        metadata: string;
        session: SessionFinalize | null;
        proof: Bytes[];
    },
) => builder.build("user_inventory_code_in_for_free", accounts, args);

export const initializeConfigInstruction = (
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        config: PublicKey;
        system_program?: PublicKey;
    },
    args: {
        merkle_root: Bytes;
    },
) => builder.build("initialize_config", accounts, args);

export const initializeDbRootInstruction = (
    builder: InstructionBuilder,
    accounts: {
        db_root: PublicKey;
        signer: PublicKey;
        system_program?: PublicKey;
    },
    args: {
        db_root_id: Bytes;
    },
) => builder.build("initialize_db_root", accounts, args);

export const manageConnectionInstruction = (
    builder: InstructionBuilder,
    accounts: {
        db_root: PublicKey;
        connection_table: PublicKey;
        signer: PublicKey;
    },
    args: {
        db_root_id: Bytes;
        connection_seed: Bytes;
        new_status: number;
    },
) => builder.build("manage_connection", accounts, args);

export const postChunkInstruction = (
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        session: PublicKey;
    },
    args: {
        index: number;
        chunk: string;
        method: number;
        decode_break: number;
    },
) => builder.build("post_chunk", accounts, args);

export const requestConnectionInstruction = (
    builder: InstructionBuilder,
    accounts: {
        requester: PublicKey;
        db_root: PublicKey;
        connection_table: PublicKey;
        instruction_table: PublicKey;
        requester_user: PublicKey;
        receiver_user: PublicKey;
        table_ref: PublicKey;
        target_table_ref: PublicKey;
        system_program?: PublicKey;
    },
    args: {
        db_root_id: Bytes;
        connection_seed: Bytes;
        receiver: PublicKey;
        table_name: Bytes;
        column_names: Bytes[];
        id_col: Bytes;
        ext_keys: Bytes[];
        user_payload: Bytes;
    },
) => builder.build("request_connection", accounts, args);

export const sendCodeInstruction = (
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        code_account: PublicKey;
        system_program?: PublicKey;
    },
    args: {
        code: string;
        before_tx: string;
        method: number;
        decode_break: number;
    },
) => builder.build("send_code", accounts, args);

export const serverInitializeInstruction = (
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        server_account: PublicKey;
        system_program?: PublicKey;
    },
    args: {
        server_id: string;
        server_type: string;
        allowed_merkle_root: string;
    },
) => builder.build("server_initialize", accounts, args);

export const setMerkleRootInstruction = (
    builder: InstructionBuilder,
    accounts: {
        authority: PublicKey;
        config: PublicKey;
    },
    args: {
        new_root: Bytes;
        new_authority: OptionalPubkey;
    },
) => builder.build("set_merkle_root", accounts, args);

export const updateDbRootTableListInstruction = (
    builder: InstructionBuilder,
    accounts: {
        db_root: PublicKey;
        signer: PublicKey;
    },
    args: {
        db_root_id: Bytes;
        new_table_seeds: Bytes[];
    },
) => builder.build("update_db_root_table_list", accounts, args);

export const updateTableInstruction = (
    builder: InstructionBuilder,
    accounts: {
        db_root: PublicKey;
        table: PublicKey;
        signer: PublicKey;
    },
    args: {
        db_root_id: Bytes;
        table_seed: Bytes;
        table_name: Bytes;
        column_names: Bytes[];
        id_col: Bytes;
        ext_keys: Bytes[];
        writers_opt: OptionalPubkeyList;
    },
) => builder.build("update_table", accounts, args);

export const updateUserMetadataInstruction = (
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        db_root: PublicKey;
        signer: PublicKey;
        system_program?: PublicKey;
    },
    args: {
        db_root_id: Bytes;
        meta: Bytes;
    },
) => builder.build("update_user_metadata", accounts, args);

export const userInitializeInstruction = (
    builder: InstructionBuilder,
    accounts: {
        user: PublicKey;
        code_account: PublicKey;
        user_state: PublicKey;
        user_inventory: PublicKey;
        system_program?: PublicKey;
    },
) => builder.build("user_initialize", accounts);

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

export const walletConnectionCodeInInstruction = (
    builder: InstructionBuilder,
    accounts: {
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
    },
    args: {
        db_root_id: Bytes;
        connection_seed: Bytes;
        on_chain_path: string;
        metadata: string;
        session: SessionFinalize | null;
    },
) => builder.build("wallet_connection_code_in", accounts, args);

export const dbCodeInInstruction = (
    builder: InstructionBuilder,
    accounts: {
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
    },
    args: {
        db_root_id: Bytes;
        table_seed: Bytes;
        on_chain_path: string;
        metadata: string;
        session: SessionFinalize | null;
    },
) => builder.build("db_code_in", accounts, args);

export const dbInstructionCodeInInstruction = (
    builder: InstructionBuilder,
    accounts: {
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
    },
    args: {
        db_root_id: Bytes;
        table_seed: Bytes;
        table_name: Bytes;
        target_tx: Bytes;
        on_chain_path: string;
        metadata: string;
        session: SessionFinalize | null;
    },
) =>
    builder.build(
        "db_instruction_code_in",
        accounts,
        args,
    );
