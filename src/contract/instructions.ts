import { BN, BorshInstructionCoder, type Idl } from "@coral-xyz/anchor";
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
  | "db_code_in_for_free"
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
): AccountMeta | null => {
  const pubkey = account.address
    ? new PublicKey(account.address)
    : accounts[account.name];

  if (!pubkey) {
    if (account.optional) {
      return null;
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

    const keys = instruction.accounts
      .map((account) => toAccountMeta(account, accounts))
      .filter((account): account is AccountMeta => Boolean(account));
    const data = coder.encode(name, args ?? {});

    return new TransactionInstruction({ programId, keys, data });
  };

  return { programId, build };
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

export type TableUpdateArgs = {
  db_root_id: Bytes;
  table_seed: Bytes;
  table_name: Bytes;
  column_names: Bytes[];
  id_col: Bytes;
  ext_keys: Bytes[];
  writers_opt: OptionalPubkeyList;
};

export type CreateAdminTableAccounts = {
  signer: PublicKey;
  db_root: PublicKey;
  table: PublicKey;
  instruction_table: PublicKey;
  table_ref: PublicKey;
  target_table_ref: PublicKey;
  system_program?: PublicKey;
};

export type CreateExtTableAccounts = CreateAdminTableAccounts;
export type CreatePrivateTableAccounts = CreateAdminTableAccounts;

export const createAdminTableInstruction = (
  builder: InstructionBuilder,
  accounts: CreateAdminTableAccounts,
  args: TableCreateArgs,
) => builder.build("create_admin_table", accounts, args);

export const createExtTableInstruction = (
  builder: InstructionBuilder,
  accounts: CreateExtTableAccounts,
  args: TableCreateArgs,
) => builder.build("create_ext_table", accounts, args);

export const createPrivateTableInstruction = (
  builder: InstructionBuilder,
  accounts: CreatePrivateTableAccounts,
  args: TableCreateArgs,
) => builder.build("create_private_table", accounts, args);

export type CreateSessionAccounts = {
  user: PublicKey;
  user_state: PublicKey;
  session: PublicKey;
  system_program?: PublicKey;
};

export type CreateSessionArgs = {
  seq: BN;
};

export const createSessionInstruction = (
  builder: InstructionBuilder,
  accounts: CreateSessionAccounts,
  args: CreateSessionArgs,
) => builder.build("create_session", accounts, args);

export type CreateTableAccounts = {
  db_root: PublicKey;
  receiver: PublicKey;
  signer: PublicKey;
  table: PublicKey;
  instruction_table: PublicKey;
  table_ref: PublicKey;
  target_table_ref: PublicKey;
  system_program?: PublicKey;
};

export const createTableInstruction = (
  builder: InstructionBuilder,
  accounts: CreateTableAccounts,
  args: TableCreateArgs,
) => builder.build("create_table", accounts, args);

export type DatabaseInstructionAccounts = {
  db_root: PublicKey;
  table: PublicKey;
  instruction_table: PublicKey;
  table_ref: PublicKey;
  target_table_ref: PublicKey;
  signer_ata?: PublicKey;
  signer: PublicKey;
};

export type DatabaseInstructionArgs = {
  db_root_id: Bytes;
  table_seed: Bytes;
  table_name: Bytes;
  target_tx: Bytes;
  content_json_tx: Bytes;
};

export const databaseInstructionInstruction = (
  builder: InstructionBuilder,
  accounts: DatabaseInstructionAccounts,
  args: DatabaseInstructionArgs,
) => builder.build("database_instruction", accounts, args);

export type DbCodeInAccounts = {
  user: PublicKey;
  db_account: PublicKey;
  system_program?: PublicKey;
};

export type DbCodeInArgs = {
  on_chain_path: string;
  metadata: string;
  session: SessionFinalize | null;
};

export const dbCodeInInstruction = (
  builder: InstructionBuilder,
  accounts: DbCodeInAccounts,
  args: DbCodeInArgs,
) => builder.build("db_code_in", accounts, args);

export type DbCodeInForFreeAccounts = {
  user: PublicKey;
  db_account: PublicKey;
  config: PublicKey;
  system_program?: PublicKey;
};

export type DbCodeInForFreeArgs = {
  on_chain_path: string;
  metadata: string;
  session: SessionFinalize | null;
  proof: Bytes[];
};

export const dbCodeInForFreeInstruction = (
  builder: InstructionBuilder,
  accounts: DbCodeInForFreeAccounts,
  args: DbCodeInForFreeArgs,
) => builder.build("db_code_in_for_free", accounts, args);

export type InitializeConfigAccounts = {
  user: PublicKey;
  config: PublicKey;
  system_program?: PublicKey;
};

export type InitializeConfigArgs = {
  merkle_root: Bytes;
};

export const initializeConfigInstruction = (
  builder: InstructionBuilder,
  accounts: InitializeConfigAccounts,
  args: InitializeConfigArgs,
) => builder.build("initialize_config", accounts, args);

export type InitializeDbRootAccounts = {
  db_root: PublicKey;
  signer: PublicKey;
  system_program?: PublicKey;
};

export type InitializeDbRootArgs = {
  db_root_id: Bytes;
};

export const initializeDbRootInstruction = (
  builder: InstructionBuilder,
  accounts: InitializeDbRootAccounts,
  args: InitializeDbRootArgs,
) => builder.build("initialize_db_root", accounts, args);

export type ManageConnectionAccounts = {
  db_root: PublicKey;
  connection_table: PublicKey;
  signer: PublicKey;
};

export type ManageConnectionArgs = {
  db_root_id: Bytes;
  connection_seed: Bytes;
  new_status: number;
};

export const manageConnectionInstruction = (
  builder: InstructionBuilder,
  accounts: ManageConnectionAccounts,
  args: ManageConnectionArgs,
) => builder.build("manage_connection", accounts, args);

export type PostChunkAccounts = {
  user: PublicKey;
  session: PublicKey;
};

export type PostChunkArgs = {
  seq: BN;
  index: number;
  chunk: string;
  method: number;
  decode_break: number;
};

export const postChunkInstruction = (
  builder: InstructionBuilder,
  accounts: PostChunkAccounts,
  args: PostChunkArgs,
) => builder.build("post_chunk", accounts, args);

export type RequestConnectionAccounts = {
  requester: PublicKey;
  db_root: PublicKey;
  connection_table: PublicKey;
  instruction_table: PublicKey;
  requester_user: PublicKey;
  receiver_user: PublicKey;
  table_ref: PublicKey;
  target_table_ref: PublicKey;
  system_program?: PublicKey;
};

export type RequestConnectionArgs = {
  db_root_id: Bytes;
  connection_seed: Bytes;
  receiver: PublicKey;
  table_name: Bytes;
  column_names: Bytes[];
  id_col: Bytes;
  ext_keys: Bytes[];
  user_payload: Bytes;
};

export const requestConnectionInstruction = (
  builder: InstructionBuilder,
  accounts: RequestConnectionAccounts,
  args: RequestConnectionArgs,
) => builder.build("request_connection", accounts, args);

export type SendCodeAccounts = {
  user: PublicKey;
  code_account: PublicKey;
  system_program?: PublicKey;
};

export type SendCodeArgs = {
  code: string;
  before_tx: string;
  method: number;
  decode_break: number;
};

export const sendCodeInstruction = (
  builder: InstructionBuilder,
  accounts: SendCodeAccounts,
  args: SendCodeArgs,
) => builder.build("send_code", accounts, args);

export type ServerInitializeAccounts = {
  user: PublicKey;
  server_account: PublicKey;
  system_program?: PublicKey;
};

export type ServerInitializeArgs = {
  server_id: string;
  server_type: string;
  allowed_merkle_root: string;
};

export const serverInitializeInstruction = (
  builder: InstructionBuilder,
  accounts: ServerInitializeAccounts,
  args: ServerInitializeArgs,
) => builder.build("server_initialize", accounts, args);

export type SetMerkleRootAccounts = {
  authority: PublicKey;
  config: PublicKey;
};

export type SetMerkleRootArgs = {
  new_root: Bytes;
  new_authority: OptionalPubkey;
};

export const setMerkleRootInstruction = (
  builder: InstructionBuilder,
  accounts: SetMerkleRootAccounts,
  args: SetMerkleRootArgs,
) => builder.build("set_merkle_root", accounts, args);

export type UpdateDbRootTableListAccounts = {
  db_root: PublicKey;
  signer: PublicKey;
};

export type UpdateDbRootTableListArgs = {
  db_root_id: Bytes;
  new_table_seeds: Bytes[];
};

export const updateDbRootTableListInstruction = (
  builder: InstructionBuilder,
  accounts: UpdateDbRootTableListAccounts,
  args: UpdateDbRootTableListArgs,
) => builder.build("update_db_root_table_list", accounts, args);

export type UpdateTableAccounts = {
  db_root: PublicKey;
  table: PublicKey;
  signer: PublicKey;
};

export const updateTableInstruction = (
  builder: InstructionBuilder,
  accounts: UpdateTableAccounts,
  args: TableUpdateArgs,
) => builder.build("update_table", accounts, args);

export type UpdateUserMetadataAccounts = {
  user: PublicKey;
  db_root: PublicKey;
  signer: PublicKey;
  system_program?: PublicKey;
};

export type UpdateUserMetadataArgs = {
  db_root_id: Bytes;
  meta: Bytes;
};

export const updateUserMetadataInstruction = (
  builder: InstructionBuilder,
  accounts: UpdateUserMetadataAccounts,
  args: UpdateUserMetadataArgs,
) => builder.build("update_user_metadata", accounts, args);

export type UserInitializeAccounts = {
  user: PublicKey;
  code_account: PublicKey;
  user_state: PublicKey;
  db_account: PublicKey;
  system_program?: PublicKey;
};

export const userInitializeInstruction = (
  builder: InstructionBuilder,
  accounts: UserInitializeAccounts,
) => builder.build("user_initialize", accounts);

export type WriteConnectionDataAccounts = {
  db_root: PublicKey;
  connection_table: PublicKey;
  table_ref: PublicKey;
  signer: PublicKey;
};

export type WriteConnectionDataArgs = {
  db_root_id: Bytes;
  connection_seed: Bytes;
  row_json_tx: Bytes;
};

export const writeConnectionDataInstruction = (
  builder: InstructionBuilder,
  accounts: WriteConnectionDataAccounts,
  args: WriteConnectionDataArgs,
) => builder.build("write_connection_data", accounts, args);

export type WriteDataAccounts = {
  db_root: PublicKey;
  table: PublicKey;
  table_ref: PublicKey;
  signer_ata?: PublicKey;
  signer: PublicKey;
};

export type WriteDataArgs = {
  db_root_id: Bytes;
  table_seed: Bytes;
  row_json_tx: Bytes;
};

export const writeDataInstruction = (
  builder: InstructionBuilder,
  accounts: WriteDataAccounts,
  args: WriteDataArgs,
) => builder.build("write_data", accounts, args);
