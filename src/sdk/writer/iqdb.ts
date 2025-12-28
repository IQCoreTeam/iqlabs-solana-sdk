import {BorshAccountsCoder, type Idl} from "@coral-xyz/anchor";
import {
    Connection,
    PublicKey,
    SystemProgram,
    type Signer,
} from "@solana/web3.js";

import {
    createAnchorProfile,
    createInstructionBuilder,
    getConnectionInstructionTablePda,
    getConnectionTablePda,
    getConnectionTableRefPda,
    getDbRootPda,
    getTablePda,
    getTableRefPda,
    getTargetConnectionTableRefPda,
    getUserPda,
    requestConnectionInstruction,
    writeConnectionDataInstruction,
    writeDataInstruction,
    type ProgramProfile,
} from "../../contract";
import {codein} from "./code_in";
import {sendTx} from "./writer_utils";
import {deriveDmSeed, deriveSeedBytes} from "../utils/seed";

// IQDB writer planning notes:
// - Reference: /Users/sumin/WebstormProjects/IQDababaseSdkMainnet/src/functions/writers/insertRow.ts
// - Validation rule: fetch table columns, reject unknown keys only.
// - Required field: id_col only (no strict "all columns required" check).
// - Ensure db_root/table/table_ref exist before write_row; request_dm can skip.
// - Always codein row JSON first, then write_data with raw txid string (no JSON wrapper).
// - write_data needs writers allowlist + gate_mint checks; verify new whitelist rules too.
// - Connection rows mirror table rows but use write_connection_data with
//   connection_seed + table_ref PDAs.
// - TODO: write_connection_data flow -> /Users/sumin/WebstormProjects/solchat-web/lib/onchainDB/web/writer.ts (writeDmRowWeb).
// - TODO: database_instruction flow -> /Users/sumin/WebstormProjects/IQDababaseSdkMainnet/src/functions/writers/insertRow.ts
//   and readRowsByTable.
//
// Pseudocode rules (reference):
// - All seeds are Uint8Array. Accept string inputs and convert using global utils:
//   - deriveSeedBytes(text) (keccak)
//   - if text is 64 hex chars, treat as raw bytes
// - Use createAnchorProfile + createInstructionBuilder with IDL for decode/encode.
// - Always use sendTx (no custom wrappers).
//
// Planned functions (args -> return):
// - ensureDbRootExists(connection, profile, dbRootId) -> Promise<void>
// - ensureTableExists(connection, profile, dbRootId, tableSeed) -> Promise<{ tablePda, tableRefPda }>
// - fetchTableMeta(connection, profile, dbRootId, tableSeed) -> Promise<{ columns, idCol, gateMint, writers }>
// - validateRowJson(connection, profile, dbRootId, tableSeed, rowJson, idCol?) -> Promise<void>
//   (fetch columns internally, reject unknown keys, require id_col)
// - resolveSignerAta(connection, signer, gateMint?) -> Promise<PublicKey | null>
// - writeRow(input, dbRootId, tableSeed, rowJson, signerAta?) -> Promise<string>
// - writeConnectionRow(input, dbRootId, connectionSeed, rowJson) -> Promise<string>
// - requestConnection(input, dbRootId, partyA, partyB, tableName, columns, idCol, extKeys) -> Promise<string>
// - deriveDmSeed(userA, userB) -> Uint8Array (global utils, shared with reader)
//
// Pseudocode: deriveDmSeed
// - input: userA, userB (pubkey strings)
// - [a, b] = sortPubkeys(userA, userB)
// - return deriveSeedBytes(`${a}:${b}`)
//
// Pseudocode: ensureDbRootExists
// - dbRoot = getDbRootPda(profile, dbRootId)
// - info = connection.getAccountInfo(dbRoot)
// - if !info -> throw "db_root not found"
//
// Pseudocode: ensureTableExists
// - dbRoot = getDbRootPda(profile, dbRootId)
// - table = getTablePda(profile, dbRoot, tableSeed)
// - tableRef = getTableRefPda(profile, dbRoot, tableSeed)
// - if !table or !tableRef -> throw "table not found"
// - return { tablePda: table, tableRefPda: tableRef }
//
// Pseudocode: fetchTableMeta
// - table = getTablePda(profile, dbRoot, tableSeed)
// - info = connection.getAccountInfo(table)
// - decode Table via BorshAccountsCoder(IDL)
// - return { columns: bytes[], idCol: bytes, gateMint: PublicKey, writers: PublicKey[] }
//
// Pseudocode: validateRowJson
// - row = JSON.parse(rowJson)
// - if row is not object -> throw
// - meta = fetchTableMeta(...)
// - allowedKeys = columns + idCol (as utf8 strings)
// - reject any key not in allowedKeys
// - require id_col key present
//
// Pseudocode: resolveSignerAta
// - if gateMint is default/empty -> return null
// - ata = getAssociatedTokenAddress(gateMint, signer.publicKey)
// - if ata account missing -> throw "missing signer_ata"
// - return ata
//
// Pseudocode: writeRow
// - ensureDbRootExists + ensureTableExists
// - validateRowJson
// - meta = fetchTableMeta
// - if writers list not empty and signer not in list -> throw
// - if gateMint set -> signerAta = resolveSignerAta
// - txid = codein({ connection, signer }, [rowJson])
// - ix = writeDataInstruction(builder, { db_root, table, table_ref, signer, signer_ata? }, { db_root_id, table_seed, row_json_tx: txid })
// - return sendTx(connection, signer, ix)
//
// Pseudocode: writeConnectionRow
// - ensureDbRootExists
// - connectionTable = getConnectionTablePda(profile, dbRoot, connectionSeed)
// - tableRef = getConnectionTableRefPda(profile, dbRoot, connectionSeed)
// - validateRowJson (same rule)
// - txid = codein({ connection, signer }, [rowJson])
// - ix = writeConnectionDataInstruction(builder, { db_root, connection_table, table_ref, signer }, { db_root_id, connection_seed, row_json_tx: txid })
// - return sendTx(connection, signer, ix)
//
// Pseudocode: requestConnection
// - seed = deriveDmSeed(partyA, partyB)
// - dbRoot = getDbRootPda(profile, dbRootId)
// - connectionTable = getConnectionTablePda(profile, dbRoot, seed)
// - instructionTable = getConnectionInstructionTablePda(profile, dbRoot, seed)
// - tableRef = getConnectionTableRefPda(profile, dbRoot, seed)
// - targetTableRef = getTargetConnectionTableRefPda(profile, dbRoot, seed)
// - payload = { dmTable: connectionTable.toBase58() }
// - ix = requestConnectionInstruction(builder, { requester, db_root, connection_table, instruction_table, requester_user, receiver_user, table_ref, target_table_ref }, args)
// - return sendTx(connection, signer, ix)

// Request DM function
// Takes wallet A and B, sorts them according to a deterministic rule (e.g. lexicographic order).
// For example, if Zo's account is `adbd2fd...` and G's account is `zmgd...`,
// Zo's account should come first and G's account second.
// The sorted pair is then hashed to derive a `connection_seed`.
//
// This logic should be added to our global utils,
// as it will also be reused by the reader.
//
// Reference implementation:
//
// export function deriveDmSeed(userA: string, userB: string): Uint8Array {
//     const [sortedA, sortedB] = sortPubkeys(userA, userB);
//     return deriveSeedBytes(`${sortedA}:${sortedB}`);
// }
//
// Using this derived seed, we should call `request_connection`
// based on the helper defined in the contract.
// Note: the root program ID should be passed as a parameter,
// since this will be used in multiple places.

const IDL = require("../../../idl/code_in.json") as Idl;
const ACCOUNT_CODER = new BorshAccountsCoder(IDL);

/// 이거는 utils폴더안에 옮겨 아마 sees ts에 옮기거나 이미 있으면 그걸 쓰게 해줘 .
function seedBytes(value: Uint8Array | string) {
    return typeof value === "string" ? deriveSeedBytes(value) : value;
}

function decodeTableMeta(data: Buffer) {
    const decoded = ACCOUNT_CODER.decode("Table", data) as {
        column_names: Uint8Array[];
        id_col: Uint8Array;
        gate_mint: PublicKey;
        writers: PublicKey[];
    };

    return {
        columns: decoded.column_names.map((value) =>
            Buffer.from(value).toString("utf8"),
        ),
        idCol: Buffer.from(decoded.id_col).toString("utf8"),
        gateMint: decoded.gate_mint,
        writers: decoded.writers,
    };
}

export async function ensureDbRootExists(
    connection: Connection,
    profile: ProgramProfile,
    dbRootId: Uint8Array | string,
) {
    const dbRootSeed = seedBytes(dbRootId);
    const dbRoot = getDbRootPda(profile, dbRootSeed);
    const info = await connection.getAccountInfo(dbRoot);
    if (!info) {
        throw new Error("db_root not found");
    }
}

export async function ensureTableExists(
    connection: Connection,
    profile: ProgramProfile,
    dbRootId: Uint8Array | string,
    tableSeed: Uint8Array | string,
) {
    const dbRootSeed = seedBytes(dbRootId);
    const dbRoot = getDbRootPda(profile, dbRootSeed);
    const tableSeedBytes = seedBytes(tableSeed);
    const tablePda = getTablePda(profile, dbRoot, tableSeedBytes);
    const tableRefPda = getTableRefPda(profile, dbRoot, tableSeedBytes);
    const [tableInfo, tableRefInfo] = await Promise.all([
        connection.getAccountInfo(tablePda),
        connection.getAccountInfo(tableRefPda),
    ]);

    if (!tableInfo || !tableRefInfo) {
        throw new Error("table not found");
    }

    return {tablePda, tableRefPda};
}

export async function fetchTableMeta(
    connection: Connection,
    profile: ProgramProfile,
    dbRootId: Uint8Array | string,
    tableSeed: Uint8Array | string,
) {
    const dbRootSeed = seedBytes(dbRootId);
    const dbRoot = getDbRootPda(profile, dbRootSeed);
    const tableSeedBytes = seedBytes(tableSeed);
    const tablePda = getTablePda(profile, dbRoot, tableSeedBytes);
    const info = await connection.getAccountInfo(tablePda);
    if (!info) {
        throw new Error("table not found");
    }

    return decodeTableMeta(info.data);
}

/// 이 fetchTableMeta도 utils에 fetch 에 넣어야 하려나 고민이 되네 왜냐면 리더에서도 쓸수도 있을거같아서 . 아니면 리더에 넣는게 깔끔하니?
export async function validateRowJson(
    connection: Connection,
    profile: ProgramProfile,
    dbRootId: Uint8Array | string,
    tableSeed: Uint8Array | string,
    rowJson: string,
    idCol?: string,
) {
    let parsed: unknown;
    try {
        parsed = JSON.parse(rowJson);
    } catch {
        throw new Error("row_json is invalid");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("row_json must be an object");
    }

    const meta = await fetchTableMeta(connection, profile, dbRootId, tableSeed);
    const requiredId = idCol ?? meta.idCol;
    const allowedKeys = new Set([...meta.columns, meta.idCol]);
    const row = parsed as Record<string, unknown>;

    for (const key of Object.keys(row)) {
        if (!allowedKeys.has(key)) {
            throw new Error(`unknown key: ${key}`);
        }
    }

    if (!Object.prototype.hasOwnProperty.call(row, requiredId)) {
        throw new Error(`missing id_col: ${requiredId}`);
    }
}

export async function resolveSignerAta(
    connection: Connection,
    signer: Signer,
    gateMint?: PublicKey,
) {
    if (!gateMint || gateMint.equals(SystemProgram.programId)) {
        return null;
    }

    const tokenProgram = new PublicKey(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    );
    const associatedTokenProgram = new PublicKey(
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efT62Jw",
    );
    const [ata] = PublicKey.findProgramAddressSync(
        [signer.publicKey.toBuffer(), tokenProgram.toBuffer(), gateMint.toBuffer()],
        associatedTokenProgram,
    );
    const info = await connection.getAccountInfo(ata);
    if (!info) {
        throw new Error("missing signer_ata");
    }

    return ata;
}

export async function writeRow(
    connection: Connection,
    signer: Signer,
    dbRootId: Uint8Array | string,
    tableSeed: Uint8Array | string,
    rowJson: string,
) {
    const profile = createAnchorProfile();
    const builder = createInstructionBuilder(IDL, profile.programId);
    const dbRootSeed = seedBytes(dbRootId);
    const tableSeedBytes = seedBytes(tableSeed);
    const dbRoot = getDbRootPda(profile, dbRootSeed);

    await ensureDbRootExists(connection, profile, dbRootSeed);
    const {tablePda, tableRefPda} = await ensureTableExists(
        connection,
        profile,
        dbRootSeed,
        tableSeedBytes,
    );
    await validateRowJson(
        connection,
        profile,
        dbRootSeed,
        tableSeedBytes,
        rowJson,
    );

    const meta = await fetchTableMeta(
        connection,
        profile,
        dbRootSeed,
        tableSeedBytes,
    );
    if (
        meta.writers.length > 0 &&
        !meta.writers.some((writer) => writer.equals(signer.publicKey))
    ) {
        throw new Error("signer not in writers");
    }

    const signerAta = await resolveSignerAta(connection, signer, meta.gateMint);
    const txid = await codein({connection, signer}, [rowJson]);
    const ix = writeDataInstruction(
        builder,
        {
            db_root: dbRoot,
            table: tablePda,
            table_ref: tableRefPda,
            signer: signer.publicKey,
            signer_ata: signerAta ?? undefined,
        },
        {
            db_root_id: dbRootSeed,
            table_seed: tableSeedBytes,
            row_json_tx: Buffer.from(txid, "utf8"),
        },
    );

    return sendTx(connection, signer, ix);
}

export async function writeConnectionRow(
    connection: Connection,
    signer: Signer,
    dbRootId: Uint8Array | string,
    connectionSeed: Uint8Array | string,
    rowJson: string,
) {
    const profile = createAnchorProfile();
    const builder = createInstructionBuilder(IDL, profile.programId);
    const dbRootSeed = seedBytes(dbRootId);
    const connectionSeedBytes = seedBytes(connectionSeed);
    const dbRoot = getDbRootPda(profile, dbRootSeed);
    const connectionTable = getConnectionTablePda(
        profile,
        dbRoot,
        connectionSeedBytes,
    );
    const tableRef = getConnectionTableRefPda(
        profile,
        dbRoot,
        connectionSeedBytes,
    );

    await ensureDbRootExists(connection, profile, dbRootSeed);
    const [tableInfo, tableRefInfo] = await Promise.all([
        connection.getAccountInfo(connectionTable),
        connection.getAccountInfo(tableRef),
    ]);
    if (!tableInfo || !tableRefInfo) {
        throw new Error("connection table not found");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(rowJson);
    } catch {
        throw new Error("row_json is invalid");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("row_json must be an object");
    }
    const meta = decodeTableMeta(tableInfo.data);
    const allowedKeys = new Set([...meta.columns, meta.idCol]);
    const row = parsed as Record<string, unknown>;
    for (const key of Object.keys(row)) {
        if (!allowedKeys.has(key)) {
            throw new Error(`unknown key: ${key}`);
        }
    }
    if (!Object.prototype.hasOwnProperty.call(row, meta.idCol)) {
        throw new Error(`missing id_col: ${meta.idCol}`);
    }

    // TODO: enforce partyA/B + status rules (see writeDmRowWeb reference).
    const txid = await codein({connection, signer}, [rowJson]);
    const ix = writeConnectionDataInstruction(
        builder,
        {
            db_root: dbRoot,
            connection_table: connectionTable,
            table_ref: tableRef,
            signer: signer.publicKey,
        },
        {
            db_root_id: dbRootSeed,
            connection_seed: connectionSeedBytes,
            row_json_tx: Buffer.from(txid, "utf8"),
        },
    );

    return sendTx(connection, signer, ix);
}

///여긴 뭔가 주석으로 나눠야 할듯
export async function requestConnection(
    connection: Connection,
    signer: Signer,
    dbRootId: Uint8Array | string,
    partyA: string,
    partyB: string,
    tableName: string | Uint8Array,
    columns: Array<string | Uint8Array>,
    idCol: string | Uint8Array,
    extKeys: Array<string | Uint8Array>,
) {
    const profile = createAnchorProfile();
    const builder = createInstructionBuilder(IDL, profile.programId);
    const requester = signer.publicKey;
    const requesterBase58 = requester.toBase58();
    if (requesterBase58 !== partyA && requesterBase58 !== partyB) {
        throw new Error("signer must be partyA or partyB");
    }

    const receiverBase58 = requesterBase58 === partyA ? partyB : partyA;
    const receiver = new PublicKey(receiverBase58);
    const dbRootSeed = seedBytes(dbRootId);
    const dbRoot = getDbRootPda(profile, dbRootSeed);
    const connectionSeedBytes = deriveDmSeed(partyA, partyB);
    const connectionTable = getConnectionTablePda(
        profile,
        dbRoot,
        connectionSeedBytes,
    );
    const instructionTable = getConnectionInstructionTablePda(
        profile,
        dbRoot,
        connectionSeedBytes,
    );
    const tableRef = getConnectionTableRefPda(
        profile,
        dbRoot,
        connectionSeedBytes,
    );
    const targetTableRef = getTargetConnectionTableRefPda(
        profile,
        dbRoot,
        connectionSeedBytes,
    );
    const requesterUser = getUserPda(profile, requester);
    const receiverUser = getUserPda(profile, receiver);
    const toBytes = (value: string | Uint8Array) =>
        typeof value === "string" ? Buffer.from(value, "utf8") : value;
    const payloadBuf = Buffer.from(
        JSON.stringify({
            dmTable: connectionTable.toBase58(),
        }),
        "utf8",
    );

    const ix = requestConnectionInstruction(
        builder,
        {
            requester,
            db_root: dbRoot,
            connection_table: connectionTable,
            instruction_table: instructionTable,
            requester_user: requesterUser,
            receiver_user: receiverUser,
            table_ref: tableRef,
            target_table_ref: targetTableRef,
            system_program: SystemProgram.programId,
        },
        {
            db_root_id: dbRootSeed,
            connection_seed: connectionSeedBytes,
            receiver,
            table_name: toBytes(tableName),
            column_names: columns.map(toBytes),
            id_col: toBytes(idCol),
            ext_keys: extKeys.map(toBytes),
            user_payload: payloadBuf,
        },
    );

    return sendTx(connection, signer, ix);
}
