"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRowJson = validateRowJson;
exports.resolveSignerAta = resolveSignerAta;
exports.writeRow = writeRow;
exports.writeConnectionRow = writeConnectionRow;
exports.manageRowData = manageRowData;
exports.requestConnection = requestConnection;
const web3_js_1 = require("@solana/web3.js");
const contract_1 = require("../../contract");
const constants_1 = require("../../constants");
const ata_1 = require("../utils/ata");
const global_fetch_1 = require("../utils/global_fetch");
const seed_1 = require("../utils/seed");
const code_in_1 = require("./code_in");
const writer_utils_1 = require("./writer_utils");
const IDL = require("../../../idl/code_in.json");
async function validateRowJson(connection, programId, dbRootId, tableSeed, rowJson, idCol) {
    let parsed;
    try {
        parsed = JSON.parse(rowJson);
    }
    catch {
        throw new Error("row_json is invalid");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("row_json must be an object");
    }
    const meta = await (0, global_fetch_1.fetchTableMeta)(connection, programId, dbRootId, tableSeed);
    const requiredId = idCol ?? meta.idCol;
    const allowedKeys = new Set([...meta.columns, meta.idCol]);
    const row = parsed;
    for (const key of Object.keys(row)) {
        if (!allowedKeys.has(key)) {
            throw new Error(`unknown key: ${key}`);
        }
    }
    if (!Object.prototype.hasOwnProperty.call(row, requiredId)) {
        throw new Error(`missing id_col: ${requiredId}`);
    }
}
async function resolveSignerAta(connection, signer, gateMint) {
    if (!gateMint || gateMint.equals(web3_js_1.SystemProgram.programId)) {
        return null;
    }
    return (0, ata_1.resolveAssociatedTokenAccount)(connection, signer.publicKey, gateMint, true);
}
async function writeRow(connection, signer, dbRootId, tableSeed, rowJson, mode = constants_1.DEFAULT_CONTRACT_MODE) {
    const programId = (0, contract_1.getProgramId)(mode);
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const tableSeedBytes = (0, seed_1.toSeedBytes)(tableSeed);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    await (0, global_fetch_1.ensureDbRootExists)(connection, programId, dbRootSeed);
    const { tablePda } = await (0, global_fetch_1.ensureTableExists)(connection, programId, dbRootSeed, tableSeedBytes);
    await validateRowJson(connection, programId, dbRootSeed, tableSeedBytes, rowJson);
    const meta = await (0, global_fetch_1.fetchTableMeta)(connection, programId, dbRootSeed, tableSeedBytes);
    if (meta.writers.length > 0 &&
        !meta.writers.some((writer) => writer.equals(signer.publicKey))) {
        throw new Error("signer not in writers");
    }
    const signerAta = await resolveSignerAta(connection, signer, meta.gateMint);
    const { builder, user, userInventory, onChainPath, metadata, sessionAccount, sessionFinalize, feeReceiver, iqAta, } = await (0, code_in_1.prepareCodeIn)({ connection, signer }, [rowJson], mode);
    const ix = (0, contract_1.dbCodeInInstruction)(builder, {
        user,
        signer: signer.publicKey,
        user_inventory: userInventory,
        db_root: dbRoot,
        table: tablePda,
        signer_ata: signerAta ?? undefined,
        system_program: web3_js_1.SystemProgram.programId,
        receiver: feeReceiver,
        session: sessionAccount,
        iq_ata: iqAta ?? undefined,
    }, {
        db_root_id: dbRootSeed,
        table_seed: tableSeedBytes,
        on_chain_path: onChainPath,
        metadata,
        session: sessionFinalize,
    });
    return (0, writer_utils_1.sendTx)(connection, signer, ix);
}
async function writeConnectionRow(connection, signer, dbRootId, connectionSeed, rowJson, mode = constants_1.DEFAULT_CONTRACT_MODE) {
    const programId = (0, contract_1.getProgramId)(mode);
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const connectionSeedBytes = (0, seed_1.toSeedBytes)(connectionSeed);
    const connectionSeedBuffer = Buffer.from(connectionSeedBytes);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    const connectionTable = (0, contract_1.getConnectionTablePda)(dbRoot, connectionSeedBytes, programId);
    const tableRef = (0, contract_1.getConnectionTableRefPda)(dbRoot, connectionSeedBytes, programId);
    await (0, global_fetch_1.ensureDbRootExists)(connection, programId, dbRootSeed);
    const [connectionInfo, tableRefInfo] = await Promise.all([
        connection.getAccountInfo(connectionTable),
        connection.getAccountInfo(tableRef),
    ]);
    if (!connectionInfo || !tableRefInfo) {
        throw new Error("connection table not found");
    }
    let parsed;
    try {
        parsed = JSON.parse(rowJson);
    }
    catch {
        throw new Error("row_json is invalid");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("row_json must be an object");
    }
    const meta = (0, global_fetch_1.decodeConnectionMeta)(connectionInfo.data);
    const access = (0, global_fetch_1.evaluateConnectionAccess)(meta, signer.publicKey);
    if (!access.allowed) {
        throw new Error(access.message ?? "connection not writable");
    }
    const allowedKeys = new Set([...meta.columns, meta.idCol]);
    const row = parsed;
    for (const key of Object.keys(row)) {
        if (!allowedKeys.has(key)) {
            throw new Error(`unknown key: ${key}`);
        }
    }
    if (!Object.prototype.hasOwnProperty.call(row, meta.idCol)) {
        throw new Error(`missing id_col: ${meta.idCol}`);
    }
    const { builder, user, userInventory, onChainPath, metadata, sessionAccount, sessionFinalize, feeReceiver, iqAta, } = await (0, code_in_1.prepareCodeIn)({ connection, signer }, [rowJson], mode);
    const ix = (0, contract_1.walletConnectionCodeInInstruction)(builder, {
        user,
        signer: signer.publicKey,
        user_inventory: userInventory,
        db_root: dbRoot,
        connection_table: connectionTable,
        table_ref: tableRef,
        system_program: web3_js_1.SystemProgram.programId,
        receiver: feeReceiver,
        session: sessionAccount,
        iq_ata: iqAta ?? undefined,
    }, {
        db_root_id: dbRootSeed,
        connection_seed: connectionSeedBuffer,
        on_chain_path: onChainPath,
        metadata,
        session: sessionFinalize,
    });
    return (0, writer_utils_1.sendTx)(connection, signer, ix);
}
async function manageRowData(connection, signer, dbRootId, seed, rowJson, tableName, targetTx, mode = constants_1.DEFAULT_CONTRACT_MODE) {
    const programId = (0, contract_1.getProgramId)(mode);
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const seedBytes = (0, seed_1.toSeedBytes)(seed);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    const tablePda = (0, contract_1.getTablePda)(dbRoot, seedBytes, programId);
    const connectionTable = (0, contract_1.getConnectionTablePda)(dbRoot, seedBytes, programId);
    await (0, global_fetch_1.ensureDbRootExists)(connection, programId, dbRootSeed);
    const [tableInfo, connectionInfo] = await Promise.all([
        connection.getAccountInfo(tablePda),
        connection.getAccountInfo(connectionTable),
    ]);
    if (tableInfo) {
        // Inline on purpose: db_instruction_code_in is only used here right now.
        if (!tableName || !targetTx) {
            throw new Error("tableName and targetTx are required for table edits");
        }
        const { tablePda: table } = await (0, global_fetch_1.ensureTableExists)(connection, programId, dbRootSeed, seedBytes);
        const instructionTable = (0, contract_1.getInstructionTablePda)(dbRoot, seedBytes, programId);
        const instructionInfo = await connection.getAccountInfo(instructionTable);
        if (!instructionInfo) {
            throw new Error("instruction table not found");
        }
        const meta = await (0, global_fetch_1.fetchTableMeta)(connection, programId, dbRootSeed, seedBytes);
        if (meta.writers.length > 0 &&
            !meta.writers.some((writer) => writer.equals(signer.publicKey))) {
            throw new Error("signer not in writers");
        }
        const signerAta = await resolveSignerAta(connection, signer, meta.gateMint);
        const { builder, user, userInventory, onChainPath, metadata, sessionAccount, sessionFinalize, feeReceiver, iqAta, } = await (0, code_in_1.prepareCodeIn)({ connection, signer }, [rowJson], mode);
        const ix = (0, contract_1.dbInstructionCodeInInstruction)(builder, {
            user,
            signer: signer.publicKey,
            user_inventory: userInventory,
            db_root: dbRoot,
            table,
            instruction_table: instructionTable,
            signer_ata: signerAta ?? undefined,
            system_program: web3_js_1.SystemProgram.programId,
            receiver: feeReceiver,
            session: sessionAccount,
            iq_ata: iqAta ?? undefined,
        }, {
            db_root_id: dbRootSeed,
            table_seed: seedBytes,
            table_name: typeof tableName === "string"
                ? Buffer.from(tableName, "utf8")
                : tableName,
            target_tx: typeof targetTx === "string"
                ? Buffer.from(targetTx, "utf8")
                : targetTx,
            on_chain_path: onChainPath,
            metadata,
            session: sessionFinalize,
        });
        return (0, writer_utils_1.sendTx)(connection, signer, ix);
    }
    if (connectionInfo) {
        return writeConnectionRow(connection, signer, dbRootSeed, seedBytes, rowJson, mode);
    }
    throw new Error("table/connection not found");
}
async function requestConnection(connection, signer, dbRootId, partyA, partyB, tableName, columns, idCol, extKeys, mode = constants_1.DEFAULT_CONTRACT_MODE) {
    // Validate requester
    const programId = (0, contract_1.getProgramId)(mode);
    const builder = (0, contract_1.createInstructionBuilder)(IDL, programId);
    const requester = signer.publicKey;
    const requesterBase58 = requester.toBase58();
    if (requesterBase58 !== partyA && requesterBase58 !== partyB) {
        throw new Error("signer must be partyA or partyB");
    }
    // Derive PDAs + user accounts
    const receiverBase58 = requesterBase58 === partyA ? partyB : partyA;
    const receiver = new web3_js_1.PublicKey(receiverBase58);
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    const connectionSeedBytes = (0, seed_1.deriveDmSeed)(partyA, partyB);
    const connectionTable = (0, contract_1.getConnectionTablePda)(dbRoot, connectionSeedBytes, programId);
    const instructionTable = (0, contract_1.getConnectionInstructionTablePda)(dbRoot, connectionSeedBytes, programId);
    const tableRef = (0, contract_1.getConnectionTableRefPda)(dbRoot, connectionSeedBytes, programId);
    const targetTableRef = (0, contract_1.getTargetConnectionTableRefPda)(dbRoot, connectionSeedBytes, programId);
    const requesterUser = (0, contract_1.getUserPda)(requester, programId);
    const receiverUser = (0, contract_1.getUserPda)(receiver, programId);
    // Encode args (payload only carries dmTable)
    const toBytes = (value) => typeof value === "string" ? Buffer.from(value, "utf8") : value;
    const payloadBuf = Buffer.from(JSON.stringify({
        dmTable: connectionTable.toBase58(),
    }), "utf8");
    // Build instruction
    const ix = (0, contract_1.requestConnectionInstruction)(builder, {
        requester,
        db_root: dbRoot,
        connection_table: connectionTable,
        instruction_table: instructionTable,
        requester_user: requesterUser,
        receiver_user: receiverUser,
        table_ref: tableRef,
        target_table_ref: targetTableRef,
        system_program: web3_js_1.SystemProgram.programId,
    }, {
        db_root_id: dbRootSeed,
        connection_seed: connectionSeedBytes,
        receiver,
        table_name: toBytes(tableName),
        column_names: columns.map(toBytes),
        id_col: toBytes(idCol),
        ext_keys: extKeys.map(toBytes),
        user_payload: payloadBuf,
    });
    // Send transaction
    return (0, writer_utils_1.sendTx)(connection, signer, ix);
}
