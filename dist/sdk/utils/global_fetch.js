"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeTableMeta = decodeTableMeta;
exports.decodeConnectionMeta = decodeConnectionMeta;
exports.ensureDbRootExists = ensureDbRootExists;
exports.ensureTableExists = ensureTableExists;
exports.fetchTableMeta = fetchTableMeta;
exports.fetchConnectionMeta = fetchConnectionMeta;
exports.evaluateConnectionAccess = evaluateConnectionAccess;
// Shared fetch helpers used by both reader and writer.
const anchor_1 = require("@coral-xyz/anchor");
const contract_1 = require("../../contract");
const seed_1 = require("./seed");
const IDL = require("../../../idl/code_in.json");
const ACCOUNT_CODER = new anchor_1.BorshAccountsCoder(IDL);
function decodeTableMeta(data) {
    const decoded = ACCOUNT_CODER.decode("Table", data);
    return {
        columns: decoded.column_names.map((value) => Buffer.from(value).toString("utf8")),
        idCol: Buffer.from(decoded.id_col).toString("utf8"),
        gateMint: decoded.gate_mint,
        writers: decoded.writers,
    };
}
function decodeConnectionMeta(data) {
    const decoded = ACCOUNT_CODER.decode("Connection", data);
    return {
        dbRootId: Buffer.from(decoded.db_root_id).toString("utf8"),
        columns: decoded.column_names.map((value) => Buffer.from(value).toString("utf8")),
        idCol: Buffer.from(decoded.id_col).toString("utf8"),
        extKeys: decoded.ext_keys.map((value) => Buffer.from(value).toString("utf8")),
        name: Buffer.from(decoded.name).toString("utf8"),
        gateMint: decoded.gate_mint,
        partyA: decoded.party_a,
        partyB: decoded.party_b,
        status: decoded.status,
        requester: decoded.requester,
        blocker: decoded.blocker,
    };
}
async function ensureDbRootExists(connection, programId, dbRootId) {
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    const info = await connection.getAccountInfo(dbRoot);
    if (!info) {
        throw new Error("db_root not found");
    }
}
async function ensureTableExists(connection, programId, dbRootId, tableSeed) {
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    const tableSeedBytes = (0, seed_1.toSeedBytes)(tableSeed);
    const tablePda = (0, contract_1.getTablePda)(dbRoot, tableSeedBytes, programId);
    const tableInfo = await connection.getAccountInfo(tablePda);
    if (!tableInfo) {
        throw new Error("table not found");
    }
    return { tablePda };
}
async function fetchTableMeta(connection, programId, dbRootId, tableSeed) {
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    const tableSeedBytes = (0, seed_1.toSeedBytes)(tableSeed);
    const tablePda = (0, contract_1.getTablePda)(dbRoot, tableSeedBytes, programId);
    const info = await connection.getAccountInfo(tablePda);
    if (!info) {
        throw new Error("table not found");
    }
    return decodeTableMeta(info.data);
}
async function fetchConnectionMeta(connection, programId, dbRootId, connectionSeed) {
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    const connectionSeedBytes = (0, seed_1.toSeedBytes)(connectionSeed);
    const connectionTable = (0, contract_1.getConnectionTablePda)(dbRoot, connectionSeedBytes, programId);
    const info = await connection.getAccountInfo(connectionTable);
    if (!info) {
        throw new Error("connection table not found");
    }
    return decodeConnectionMeta(info.data);
}
function evaluateConnectionAccess(meta, signer) {
    let status = '';
    if (meta.status === contract_1.CONNECTION_STATUS_PENDING) {
        status = "pending";
    }
    else if (meta.status === contract_1.CONNECTION_STATUS_APPROVED) {
        status = "approved";
    }
    else if (meta.status === contract_1.CONNECTION_STATUS_BLOCKED) {
        status = "blocked";
    }
    let signerIdx = -1;
    if (signer.equals(meta.partyA)) {
        signerIdx = 0;
    }
    else if (signer.equals(meta.partyB)) {
        signerIdx = 1;
    }
    else {
        return {
            allowed: false,
            status,
            message: "signer is not a connection participant",
        };
    }
    if (meta.status === contract_1.CONNECTION_STATUS_APPROVED) {
        return { allowed: true, status };
    }
    // In pending state, only the requester can send messages (like X/Twitter DM requests)
    if (meta.status === contract_1.CONNECTION_STATUS_PENDING) {
        if (signerIdx === meta.requester) {
            return { allowed: true, status };
        }
        return { allowed: false, status, message: "Allow the connection in settings." };
    }
    if (meta.status === contract_1.CONNECTION_STATUS_BLOCKED) {
        const blockerIdx = meta.blocker === contract_1.CONNECTION_BLOCKER_NONE ? null : meta.blocker;
        const message = blockerIdx === signerIdx
            ? "Allow the connection in settings."
            : "Ask the other party to unblock the connection.";
        return { allowed: false, status, message };
    }
    return { allowed: false, status, message: "invalid connection status" };
}
//# sourceMappingURL=global_fetch.js.map