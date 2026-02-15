import {type Idl} from "@coral-xyz/anchor";
import {
    Connection,
    PublicKey,
    SystemProgram,
    type Signer,
} from "@solana/web3.js";

import {
    createInstructionBuilder,
    walletConnectionCodeInInstruction,
    dbInstructionCodeInInstruction,
    dbCodeInInstruction,
    getConnectionInstructionTablePda,
    getConnectionTablePda,
    getConnectionTableRefPda,
    getDbRootPda,
    getInstructionTablePda,
    PROGRAM_ID,
    getTargetConnectionTableRefPda,
    getTablePda,
    getUserPda,
    requestConnectionInstruction,
} from "../../contract";
import {resolveAssociatedTokenAccount} from "../utils/ata";
import {
    decodeConnectionMeta,
    evaluateConnectionAccess,
    ensureDbRootExists,
    ensureTableExists,
    fetchTableMeta,
} from "../utils/global_fetch";
import {deriveDmSeed, toSeedBytes} from "../utils/seed";
import {prepareCodeIn} from "./code_in";
import {sendTx} from "./writer_utils";
import {DB_METADATA_MAX_BYTES} from "../constants";

/** DB writes never inline data into metadata — data goes through chunks,
 *  metadata carries only type + offset fields. */
const DB_PREPARE_OPTS = {neverInline: true, maxMetadataBytes: DB_METADATA_MAX_BYTES} as const;

const IDL = require("../../../idl/code_in.json") as Idl;

export async function validateRowJson(
    connection: Connection,
    programId: PublicKey,
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

    const meta = await fetchTableMeta(connection, programId, dbRootId, tableSeed);
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

    return meta;
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
    skipConfirmation = false,
) {
    const programId = PROGRAM_ID;
    const dbRootSeed = toSeedBytes(dbRootId);
    const tableSeedBytes = toSeedBytes(tableSeed);
    const dbRoot = getDbRootPda(dbRootSeed, programId);

    await ensureDbRootExists(connection, programId, dbRootSeed);
    const {tablePda} = await ensureTableExists(
        connection,
        programId,
        dbRootSeed,
        tableSeedBytes,
    );
    const meta = await validateRowJson(
        connection,
        programId,
        dbRootSeed,
        tableSeedBytes,
        rowJson,
    );
    if (
        meta.writers.length > 0 &&
        !meta.writers.some((writer) => writer.equals(signer.publicKey))
    ) {
        throw new Error("signer not in writers");
    }

    const signerAta = await resolveSignerAta(connection, signer, meta.gateMint);
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
    } = await prepareCodeIn({connection, signer}, [rowJson], undefined, 0, "", undefined, DB_PREPARE_OPTS);
    const ix = dbCodeInInstruction(
        builder,
        {
            user,
            signer: signer.publicKey,
            user_inventory: userInventory,
            db_root: dbRoot,
            table: tablePda,
            signer_ata: signerAta ?? undefined,
            system_program: SystemProgram.programId,
            receiver: feeReceiver,
            session: sessionAccount,
            iq_ata: iqAta ?? undefined,
        },
        {
            db_root_id: dbRootSeed,
            table_seed: tableSeedBytes,
            on_chain_path: onChainPath,
            metadata,
            session: sessionFinalize,
        },
    );
    return sendTx(connection, signer, ix, skipConfirmation);
}

export async function writeConnectionRow(
    connection: Connection,
    signer: Signer,
    dbRootId: Uint8Array | string,
    connectionSeed: Uint8Array | string,
    rowJson: string,
) {
    const programId = PROGRAM_ID;
    const dbRootSeed = toSeedBytes(dbRootId);
    const connectionSeedBytes = toSeedBytes(connectionSeed);
    const connectionSeedBuffer = Buffer.from(connectionSeedBytes);
    const dbRoot = getDbRootPda(dbRootSeed, programId);
    const connectionTable = getConnectionTablePda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );
    const tableRef = getConnectionTableRefPda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );

    await ensureDbRootExists(connection, programId, dbRootSeed);
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
    } = await prepareCodeIn({connection, signer}, [rowJson], undefined, 0, "", undefined, DB_PREPARE_OPTS);
    const ix = walletConnectionCodeInInstruction(
        builder,
        {
            user,
            signer: signer.publicKey,
            user_inventory: userInventory,
            db_root: dbRoot,
            connection_table: connectionTable,
            table_ref: tableRef,
            system_program: SystemProgram.programId,
            receiver: feeReceiver,
            session: sessionAccount,
            iq_ata: iqAta ?? undefined,
        },
        {
            db_root_id: dbRootSeed,
            connection_seed: connectionSeedBuffer,
            on_chain_path: onChainPath,
            metadata,
            session: sessionFinalize,
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
    const programId = PROGRAM_ID;
    const dbRootSeed = toSeedBytes(dbRootId);
    const seedBytes = toSeedBytes(seed);
    const dbRoot = getDbRootPda(dbRootSeed, programId);
    const tablePda = getTablePda(dbRoot, seedBytes, programId);
    const connectionTable = getConnectionTablePda(dbRoot, seedBytes, programId);

    await ensureDbRootExists(connection, programId, dbRootSeed);
    const [tableInfo, connectionInfo] = await Promise.all([
        connection.getAccountInfo(tablePda),
        connection.getAccountInfo(connectionTable),
    ]);

    if (tableInfo) {
        // Inline on purpose: db_instruction_code_in is only used here right now.
        if (!tableName || !targetTx) {
            throw new Error("tableName and targetTx are required for table edits");
        }

        const {tablePda: table} =
            await ensureTableExists(connection, programId, dbRootSeed, seedBytes);

        const instructionTable = getInstructionTablePda(
            dbRoot,
            seedBytes,
            programId,
        );

        const instructionInfo = await connection.getAccountInfo(instructionTable);
        if (!instructionInfo) {
            throw new Error("instruction table not found");
        }

        const meta = await fetchTableMeta(connection, programId, dbRootSeed, seedBytes);
        if (
            meta.writers.length > 0 &&
            !meta.writers.some((writer) => writer.equals(signer.publicKey))
        ) {
            throw new Error("signer not in writers");
        }

        const signerAta = await resolveSignerAta(connection, signer, meta.gateMint);
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
        } = await prepareCodeIn({connection, signer}, [rowJson], undefined, 0, "", undefined, DB_PREPARE_OPTS);
        const ix = dbInstructionCodeInInstruction(
            builder,
            {
                user,
                signer: signer.publicKey,
                user_inventory: userInventory,
                db_root: dbRoot,
                table,
                instruction_table: instructionTable,
                signer_ata: signerAta ?? undefined,
                system_program: SystemProgram.programId,
                receiver: feeReceiver,
                session: sessionAccount,
                iq_ata: iqAta ?? undefined,
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
                on_chain_path: onChainPath,
                metadata,
                session: sessionFinalize,
            },
        );
        return sendTx(connection, signer, ix);
    }
    if (connectionInfo) {
        return writeConnectionRow(
            connection,
            signer,
            dbRootSeed,
            seedBytes,
            rowJson,
        );

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
    const programId = PROGRAM_ID;
    const builder = createInstructionBuilder(IDL, programId);
    const requester = signer.publicKey;
    const requesterBase58 = requester.toBase58();
    if (requesterBase58 !== partyA && requesterBase58 !== partyB) {
        throw new Error("signer must be partyA or partyB");
    }

    // Derive PDAs + user accounts
    const receiverBase58 = requesterBase58 === partyA ? partyB : partyA;
    const receiver = new PublicKey(receiverBase58);
    const dbRootSeed = toSeedBytes(dbRootId);
    const dbRoot = getDbRootPda(dbRootSeed, programId);
    const connectionSeedBytes = deriveDmSeed(partyA, partyB);
    const connectionTable = getConnectionTablePda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );
    const instructionTable = getConnectionInstructionTablePda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );
    const tableRef = getConnectionTableRefPda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );
    const targetTableRef = getTargetConnectionTableRefPda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );
    const requesterUser = getUserPda(requester, programId);
    const receiverUser = getUserPda(receiver, programId);

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
