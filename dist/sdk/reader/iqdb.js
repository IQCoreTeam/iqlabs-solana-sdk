"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readConnection = readConnection;
exports.getTablelistFromRoot = getTablelistFromRoot;
exports.readTableRows = readTableRows;
const web3_js_1 = require("@solana/web3.js");
const contract_1 = require("../../contract");
const constants_1 = require("../../constants");
const connection_helper_1 = require("../utils/connection_helper");
const global_fetch_1 = require("../utils/global_fetch");
const rate_limiter_1 = require("../utils/rate_limiter");
const session_speed_1 = require("../utils/session_speed");
const seed_1 = require("../utils/seed");
const read_code_in_1 = require("./read_code_in");
const reader_context_1 = require("./reader_context");
const reader_utils_1 = require("./reader_utils");
const resolveConnectionStatus = (status) => {
    if (status === contract_1.CONNECTION_STATUS_PENDING) {
        return "pending";
    }
    if (status === contract_1.CONNECTION_STATUS_APPROVED) {
        return "approved";
    }
    if (status === contract_1.CONNECTION_STATUS_BLOCKED) {
        return "blocked";
    }
    return "unknown";
};
async function readConnection(dbRootId, partyA, partyB, mode = constants_1.DEFAULT_CONTRACT_MODE) {
    const connection = (0, connection_helper_1.getConnection)();
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const programId = (0, reader_context_1.resolveReaderProgramId)(mode);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    const connectionSeed = (0, seed_1.deriveDmSeed)(partyA, partyB);
    const connectionTable = (0, contract_1.getConnectionTablePda)(dbRoot, connectionSeed, programId);
    const info = await connection.getAccountInfo(connectionTable);
    if (!info) {
        throw new Error("connection table not found");
    }
    const meta = (0, global_fetch_1.decodeConnectionMeta)(info.data);
    const status = resolveConnectionStatus(meta.status);
    const requester = meta.requester === 0 ? "a" : "b";
    const blocker = meta.blocker === 0 ? "a" : meta.blocker === 1 ? "b" : "none";
    return {
        status: status,
        requester,
        blocker,
    };
}
async function getTablelistFromRoot(connection, dbRootId, mode = constants_1.DEFAULT_CONTRACT_MODE) {
    const programId = (0, reader_context_1.resolveReaderProgramId)(mode);
    const dbRootSeed = (0, seed_1.toSeedBytes)(dbRootId);
    const dbRoot = (0, contract_1.getDbRootPda)(dbRootSeed, programId);
    const info = await connection.getAccountInfo(dbRoot);
    if (!info) {
        return {
            rootPda: dbRoot,
            creator: null,
            tableSeeds: [],
            globalTableSeeds: [],
        };
    }
    const decoded = reader_context_1.readerContext.accountCoder.decode("DbRoot", info.data);
    const creator = decoded?.creator
        ? new web3_js_1.PublicKey(decoded.creator).toBase58()
        : null;
    const toHex = (value) => {
        if (value instanceof Uint8Array) {
            return Buffer.from(value).toString("hex");
        }
        if (Array.isArray(value)) {
            return Buffer.from(value).toString("hex");
        }
        if (value?.data && Array.isArray(value.data)) {
            return Buffer.from(value.data).toString("hex");
        }
        return "";
    };
    const rawTableSeeds = decoded.table_seeds ??
        decoded.tableSeeds ??
        decoded.table_names ??
        decoded.tableNames ??
        [];
    const rawGlobalSeeds = decoded.global_table_seeds ??
        decoded.globalTableSeeds ??
        decoded.global_table_names ??
        decoded.globalTableNames ??
        [];
    const tableSeeds = rawTableSeeds.map((value) => toHex(value));
    const globalTableSeeds = rawGlobalSeeds.map((value) => toHex(value));
    return {
        rootPda: dbRoot,
        creator,
        tableSeeds,
        globalTableSeeds,
    };
}
///TODO we need to support the function that read the table's and instruction aswell and sort it, it will be good for
// make 2 function and call them by branch with mutable? option,  is that mutable, we need to sort , "I can change the word mutable if that's not awesome"
async function readTableRows(account, options = {}) {
    const { before, limit, speed } = options;
    const signatures = await (0, reader_utils_1.fetchAccountTransactions)(account, { before, limit });
    const speedKey = (0, session_speed_1.resolveSessionSpeed)(speed);
    const limiter = (0, rate_limiter_1.createRateLimiter)(session_speed_1.SESSION_SPEED_PROFILES[speedKey].maxRps);
    const rows = [];
    for (const sig of signatures) {
        if (limiter) {
            await limiter.wait();
        }
        let result; //data { SESSIONPDA:NDJKFNDJNKFJAFDDSFADF} metadata{file name filetype etc
        try {
            result = await (0, read_code_in_1.readCodeIn)(sig.signature, speed);
        }
        catch (err) {
            if (err instanceof Error &&
                err.message.includes("user_inventory_code_in instruction not found")) {
                continue;
            }
            throw err;
        }
        const { data, metadata } = result;
        if (!data) {
            rows.push({ signature: sig.signature, metadata, data: null });
            continue;
        }
        try {
            const parsed = JSON.parse(data);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                rows.push({ ...parsed, __txSignature: sig.signature });
                continue;
            }
        }
        catch {
            // fallthrough
        }
        rows.push({ signature: sig.signature, metadata, data });
    }
    return rows;
}
