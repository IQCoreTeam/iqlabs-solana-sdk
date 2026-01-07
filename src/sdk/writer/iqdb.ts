import {type Idl} from "@coral-xyz/anchor";
import {
    Connection,
    PublicKey,
    SystemProgram,
    type Signer,
} from "@solana/web3.js";

import {
    createAnchorProfile,
    createInstructionBuilder,
    databaseInstructionInstruction,
    getConnectionInstructionTablePda,
    getConnectionTablePda,
    getConnectionTableRefPda,
    getDbRootPda,
    getInstructionTablePda,
    getTargetConnectionTableRefPda,
    getUserPda,
    getTablePda,
    requestConnectionInstruction,
    writeConnectionDataInstruction,
    writeDataInstruction,
    type ProgramProfile,
} from "../../contract";
import {codein} from "./code_in";
import {sendTx} from "./writer_utils";
import {
    decodeConnectionMeta,
    evaluateConnectionAccess,
    ensureDbRootExists,
    ensureTableExists,
    fetchTableMeta,
} from "../utils/global_fetch";
import {DIRECT_METADATA_MAX_BYTES} from "../constants";
import {resolveAssociatedTokenAccount} from "../utils/ata";
import {deriveDmSeed, toSeedBytes} from "../utils/seed";

const IDL = require("../../../idl/code_in.json") as Idl;

const buildTableTrailPayload = (rowJson: string, txid: string) => {
    const payload = JSON.stringify({data: rowJson, tx: txid});
    return Buffer.byteLength(payload, "utf8") <= DIRECT_METADATA_MAX_BYTES
        ? payload
        : txid;
};

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

    return resolveAssociatedTokenAccount(
        connection,
        signer.publicKey,
        gateMint,
        true,
    );
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
    const dbRootSeed = toSeedBytes(dbRootId);
    const tableSeedBytes = toSeedBytes(tableSeed);
    const dbRoot = getDbRootPda(profile, dbRootSeed);

    await ensureDbRootExists(connection, profile, dbRootSeed);
    const {tablePda} = await ensureTableExists(
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
    const payload = buildTableTrailPayload(rowJson, txid);
    const ix = writeDataInstruction(
        builder,
        {
            db_root: dbRoot,
            table: tablePda,
            signer: signer.publicKey,
            signer_ata: signerAta ?? undefined,
        },
        {
            db_root_id: dbRootSeed,
            table_seed: tableSeedBytes,
            row_json_tx: Buffer.from(payload, "utf8"),
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
    const dbRootSeed = toSeedBytes(dbRootId);
    const connectionSeedBytes = toSeedBytes(connectionSeed);
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
    const [connectionInfo, tableRefInfo] = await Promise.all([
        connection.getAccountInfo(connectionTable),
        connection.getAccountInfo(tableRef),
    ]);
    if (!connectionInfo || !tableRefInfo) {
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
    const meta = decodeConnectionMeta(connectionInfo.data);
    const access = evaluateConnectionAccess(meta, signer.publicKey);
    if (!access.allowed) {
        throw new Error(access.message ?? "connection not writable");
    }
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

export async function manageRowData(
    connection: Connection,
    signer: Signer,
    dbRootId: Uint8Array | string,
    seed: Uint8Array | string,
    rowJson: string,
    tableName?: string | Uint8Array,
    targetTx?: string | Uint8Array,
) {
    const profile = createAnchorProfile();
    const builder = createInstructionBuilder(IDL, profile.programId);
    const dbRootSeed = toSeedBytes(dbRootId);
    const seedBytes = toSeedBytes(seed);
    const dbRoot = getDbRootPda(profile, dbRootSeed);
    const tablePda = getTablePda(profile, dbRoot, seedBytes);
    const connectionTable = getConnectionTablePda(profile, dbRoot, seedBytes);

    await ensureDbRootExists(connection, profile, dbRootSeed);
    const [tableInfo, connectionInfo] = await Promise.all([
        connection.getAccountInfo(tablePda),
        connection.getAccountInfo(connectionTable),
    ]);

    if (tableInfo) {
        // Inline on purpose: database_instruction is only used here right now.
        if (!tableName || !targetTx) {
            throw new Error("tableName and targetTx are required for table edits");
        }

        const {tablePda: table} =
            await ensureTableExists(connection, profile, dbRootSeed, seedBytes);
        const instructionTable = getInstructionTablePda(
            profile,
            dbRoot,
            seedBytes,
        );
        const instructionInfo = await connection.getAccountInfo(instructionTable);
        if (!instructionInfo) {
            throw new Error("instruction table not found");
        }

        const meta = await fetchTableMeta(connection, profile, dbRootSeed, seedBytes);
        if (
            meta.writers.length > 0 &&
            !meta.writers.some((writer) => writer.equals(signer.publicKey))
        ) {
            throw new Error("signer not in writers");
        }

        const signerAta = await resolveSignerAta(connection, signer, meta.gateMint);
        const contentTx = await codein({connection, signer}, [rowJson]);
        const payload = buildTableTrailPayload(rowJson, contentTx);
        const ix = databaseInstructionInstruction(
            builder,
            {
                db_root: dbRoot,
                table,
                instruction_table: instructionTable,
                signer_ata: signerAta ?? undefined,
                signer: signer.publicKey,
            },
            {
                db_root_id: dbRootSeed,
                table_seed: seedBytes,
                table_name:
                    typeof tableName === "string"
                        ? Buffer.from(tableName, "utf8")
                        : tableName,
                target_tx:
                    typeof targetTx === "string"
                        ? Buffer.from(targetTx, "utf8")
                        : targetTx,
                content_json_tx: Buffer.from(payload, "utf8"),
            },
        );

        return sendTx(connection, signer, ix);
    }

    if (connectionInfo) {
        return writeConnectionRow(connection, signer, dbRootSeed, seedBytes, rowJson);
    }

    throw new Error("table/connection not found");
}

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
    // Validate requester
    const profile = createAnchorProfile();
    const builder = createInstructionBuilder(IDL, profile.programId);
    const requester = signer.publicKey;
    const requesterBase58 = requester.toBase58();
    if (requesterBase58 !== partyA && requesterBase58 !== partyB) {
        throw new Error("signer must be partyA or partyB");
    }

    // Derive PDAs + user accounts
    const receiverBase58 = requesterBase58 === partyA ? partyB : partyA;
    const receiver = new PublicKey(receiverBase58);
    const dbRootSeed = toSeedBytes(dbRootId);
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

    // Encode args (payload only carries dmTable)
    const toBytes = (value: string | Uint8Array) =>
        typeof value === "string" ? Buffer.from(value, "utf8") : value;
    const payloadBuf = Buffer.from(
        JSON.stringify({
            dmTable: connectionTable.toBase58(),
        }),
        "utf8",
    );

    // Build instruction
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

    // Send transaction
    return sendTx(connection, signer, ix);
}
