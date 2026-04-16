"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTable = createTable;
exports.validateRowJson = validateRowJson;
exports.resolveSignerAta = resolveSignerAta;
exports.writeRow = writeRow;
exports.writeConnectionRow = writeConnectionRow;
exports.manageRowData = manageRowData;
exports.updateUserMetadata = updateUserMetadata;
exports.requestConnection = requestConnection;
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const contract_1 = require("../../contract");
const ata_1 = require("../utils/ata");
const global_fetch_1 = require("../utils/global_fetch");
const seed_1 = require("../utils/seed");
const constants_1 = require("../constants");
const code_in_1 = require("./code_in");
const writer_utils_1 = require("./writer_utils");
const IDL = require("../../../idl/code_in.json");
const ACCOUNT_CODER = new anchor_1.BorshAccountsCoder(IDL);
// Default extra space per realloc
const REALLOC_EXTRA = 2048;
const vecVecSerializedSize = (vv) => 4 + vv.reduce((s, v) => s + 4 + v.length, 0);
/**
 * Build a realloc instruction if the DbRoot account doesn't have enough
 * space for the incoming hint. Guarantees at least `neededExtra` bytes
 * of free space after realloc, plus REALLOC_EXTRA for future headroom.
 */
function buildReallocIxIfNeeded(builder, payer, target, accountData, neededExtra = 0) {
    const decoded = ACCOUNT_CODER.decode("DbRoot", accountData);
    const usedBytes = 8 + 32
        + vecVecSerializedSize(decoded.table_seeds)
        + vecVecSerializedSize(decoded.global_table_seeds)
        + 4 + decoded.id.length;
    const freeBytes = accountData.length - usedBytes;
    const minRequired = Math.max(neededExtra, 128);
    if (freeBytes >= minRequired)
        return null;
    // Grow enough for the immediate need + headroom for future entries
    const growBy = Math.max(REALLOC_EXTRA, minRequired - freeBytes + REALLOC_EXTRA);
    return (0, contract_1.reallocAccountInstruction)(builder, { payer, target, system_program: web3_js_1.SystemProgram.programId }, { new_size: new anchor_1.BN(accountData.length + growBy) });
}
async function createTable(connection, signer, dbRootId, tableSeed, tableName, columnNames, idCol, extKeys, gate, writers, tableHint) {
    const programId = contract_1.PROGRAM_ID;
    const builder = (0, contract_1.createInstructionBuilder)(IDL, programId);
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const tableSeedBytes = (0, seed_1.toSeedBytes)(tableSeed);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    const table = (0, contract_1.getTablePda)(dbRoot, tableSeedBytes, programId);
    const instructionTable = (0, contract_1.getInstructionTablePda)(dbRoot, tableSeedBytes, programId);
    const toBytes = (v) => typeof v === "string" ? Buffer.from(v, "utf8") : v;
    // table_hint defaults to the original tableSeed string for backwards compat
    const hintBytes = tableHint
        ? toBytes(tableHint)
        : typeof tableSeed === "string" ? Buffer.from(tableSeed, "utf8") : tableSeedBytes;
    const dbRootInfo = await connection.getAccountInfo(dbRoot);
    if (!dbRootInfo)
        throw new Error("db_root not found");
    const ixs = [];
    // hint is stored twice (table_seeds + global_table_seeds), so need space for both
    const hintSpace = (4 + hintBytes.length) * 2;
    const reallocIx = buildReallocIxIfNeeded(builder, signer.publicKey, dbRoot, dbRootInfo.data, hintSpace);
    if (reallocIx)
        ixs.push(reallocIx);
    ixs.push((0, contract_1.createTableInstruction)(builder, {
        db_root: dbRoot,
        receiver: new web3_js_1.PublicKey(constants_1.DEFAULT_WRITE_FEE_RECEIVER),
        signer: signer.publicKey,
        table,
        instruction_table: instructionTable,
        system_program: web3_js_1.SystemProgram.programId,
    }, {
        db_root_id: dbRootSeed,
        table_seed: tableSeedBytes,
        table_hint: hintBytes,
        table_name: toBytes(tableName),
        column_names: columnNames.map(toBytes),
        id_col: toBytes(idCol),
        ext_keys: extKeys.map(toBytes),
        gate_opt: gate
            ? { mint: gate.mint, amount: new anchor_1.BN(gate.amount ?? 1), gate_type: gate.gateType ?? contract_1.GateType.Token }
            : null,
        writers_opt: writers ?? null,
    }));
    return (0, writer_utils_1.sendTx)(connection, signer, ixs);
}
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
    return meta;
}
async function resolveSignerAta(connection, signer, gateMint) {
    if (gateMint.equals(web3_js_1.PublicKey.default)) {
        return null;
    }
    return (0, ata_1.resolveAssociatedTokenAccount)(connection, signer.publicKey, gateMint, true);
}
const METAPLEX_PROGRAM_ID = new web3_js_1.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
function getMetadataPda(mint) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("metadata"), METAPLEX_PROGRAM_ID.toBuffer(), mint.toBuffer()], METAPLEX_PROGRAM_ID)[0];
}
async function resolveGateAccounts(connection, signer, gate) {
    const signerAta = await resolveSignerAta(connection, signer, gate.mint);
    if (!signerAta)
        return { signerAta: undefined, metadataAccount: undefined };
    // For collection gates, we need the metadata PDA of the NFT mint (not the collection key).
    // The client must resolve which NFT they hold; for now the ATA mint is used.
    // Collection gate metadata resolution requires reading the ATA to get the actual NFT mint.
    let metadataAccount;
    if (gate.gateType === contract_1.GateType.Collection) {
        const ataInfo = await connection.getAccountInfo(signerAta);
        if (ataInfo && ataInfo.data.length >= 64) {
            // SPL token account layout: mint is at offset 0, 32 bytes
            const nftMint = new web3_js_1.PublicKey(ataInfo.data.subarray(0, 32));
            metadataAccount = getMetadataPda(nftMint);
        }
    }
    return { signerAta, metadataAccount };
}
async function writeRow(connection, signer, dbRootId, tableSeed, rowJson, skipConfirmation = false, remainingAccounts) {
    const programId = contract_1.PROGRAM_ID;
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const tableSeedBytes = (0, seed_1.toSeedBytes)(tableSeed);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    await (0, global_fetch_1.ensureDbRootExists)(connection, programId, dbRootSeed);
    const { tablePda } = await (0, global_fetch_1.ensureTableExists)(connection, programId, dbRootSeed, tableSeedBytes);
    const meta = await validateRowJson(connection, programId, dbRootSeed, tableSeedBytes, rowJson);
    if (meta.writers.length > 0 &&
        !meta.writers.some((writer) => writer.equals(signer.publicKey))) {
        throw new Error("signer not in writers");
    }
    const hasGate = meta.gate && !meta.gate.mint.equals(web3_js_1.SystemProgram.programId);
    const { signerAta, metadataAccount } = hasGate
        ? await resolveGateAccounts(connection, signer, meta.gate)
        : { signerAta: undefined, metadataAccount: undefined };
    const { builder, user, userInventory, onChainPath, metadata, sessionAccount, sessionFinalize, feeReceiver, iqAta, } = await (0, code_in_1.prepareCodeIn)({ connection, signer }, rowJson);
    const ix = (0, contract_1.dbCodeInInstruction)(builder, {
        user,
        signer: signer.publicKey,
        user_inventory: userInventory,
        db_root: dbRoot,
        table: tablePda,
        signer_ata: signerAta,
        metadata_account: metadataAccount,
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
    }, remainingAccounts);
    return (0, writer_utils_1.sendTx)(connection, signer, ix, skipConfirmation);
}
async function writeConnectionRow(connection, signer, dbRootId, connectionSeed, rowJson) {
    const programId = contract_1.PROGRAM_ID;
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
    // Connection payloads are application-defined (plain or encrypted).
    // The on-chain program stores the blob without key validation,
    // so the SDK should not enforce column-name checks here.
    const { builder, user, userInventory, onChainPath, metadata, sessionAccount, sessionFinalize, feeReceiver, iqAta, } = await (0, code_in_1.prepareCodeIn)({ connection, signer }, rowJson);
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
async function manageRowData(connection, signer, dbRootId, seed, rowJson, tableName, targetTx) {
    const programId = contract_1.PROGRAM_ID;
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
        const hasGate = meta.gate && !meta.gate.mint.equals(web3_js_1.SystemProgram.programId);
        const { signerAta, metadataAccount } = hasGate
            ? await resolveGateAccounts(connection, signer, meta.gate)
            : { signerAta: undefined, metadataAccount: undefined };
        const { builder, user, userInventory, onChainPath, metadata, sessionAccount, sessionFinalize, feeReceiver, iqAta, } = await (0, code_in_1.prepareCodeIn)({ connection, signer }, rowJson);
        const ix = (0, contract_1.dbInstructionCodeInInstruction)(builder, {
            user,
            signer: signer.publicKey,
            user_inventory: userInventory,
            db_root: dbRoot,
            table,
            instruction_table: instructionTable,
            signer_ata: signerAta,
            metadata_account: metadataAccount,
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
        return writeConnectionRow(connection, signer, dbRootSeed, seedBytes, rowJson);
    }
    throw new Error("table/connection not found");
}
async function updateUserMetadata(connection, signer, dbRootId, meta) {
    const programId = contract_1.PROGRAM_ID;
    const builder = (0, contract_1.createInstructionBuilder)(IDL, programId);
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    const user = (0, contract_1.getUserPda)(signer.publicKey, programId);
    const metaBytes = typeof meta === "string" ? Buffer.from(meta, "utf8") : meta;
    const ix = (0, contract_1.updateUserMetadataInstruction)(builder, {
        user,
        db_root: dbRoot,
        signer: signer.publicKey,
        system_program: web3_js_1.SystemProgram.programId,
    }, {
        db_root_id: dbRootSeed,
        meta: metaBytes,
    });
    return (0, writer_utils_1.sendTx)(connection, signer, ix);
}
async function requestConnection(connection, signer, dbRootId, partyA, partyB, tableName, columns, idCol, extKeys) {
    // Validate requester
    const programId = contract_1.PROGRAM_ID;
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
