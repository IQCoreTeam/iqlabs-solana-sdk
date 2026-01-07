// Shared fetch helpers used by both reader and writer.
import {BorshAccountsCoder, type Idl} from "@coral-xyz/anchor";
import {Connection, PublicKey} from "@solana/web3.js";

import {
    CONNECTION_BLOCKER_NONE,
    CONNECTION_STATUS_APPROVED,
    CONNECTION_STATUS_BLOCKED,
    CONNECTION_STATUS_PENDING,
    getConnectionTablePda,
    getDbRootPda,
    getTablePda,
    type ProgramProfile,
} from "../../contract";
import {toSeedBytes} from "./seed";

const IDL = require("../../../idl/code_in.json") as Idl;
const ACCOUNT_CODER = new BorshAccountsCoder(IDL);

export function decodeTableMeta(data: Buffer) {
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

export function decodeConnectionMeta(data: Buffer) {
    const decoded = ACCOUNT_CODER.decode("Connection", data) as {
        column_names: Uint8Array[];
        id_col: Uint8Array;
        ext_keys: Uint8Array[];
        name: Uint8Array;
        gate_mint: PublicKey;
        party_a: PublicKey;
        party_b: PublicKey;
        status: number;
        requester: number;
        blocker: number;
    };

    return {
        columns: decoded.column_names.map((value) =>
            Buffer.from(value).toString("utf8"),
        ),
        idCol: Buffer.from(decoded.id_col).toString("utf8"),
        extKeys: decoded.ext_keys.map((value) =>
            Buffer.from(value).toString("utf8"),
        ),
        name: Buffer.from(decoded.name).toString("utf8"),
        gateMint: decoded.gate_mint,
        partyA: decoded.party_a,
        partyB: decoded.party_b,
        status: decoded.status,
        requester: decoded.requester,
        blocker: decoded.blocker,
    };
}

export async function ensureDbRootExists(
    connection: Connection,
    profile: ProgramProfile,
    dbRootId: Uint8Array | string,
) {
    const dbRootSeed = toSeedBytes(dbRootId);
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
    const dbRootSeed = toSeedBytes(dbRootId);
    const dbRoot = getDbRootPda(profile, dbRootSeed);
    const tableSeedBytes = toSeedBytes(tableSeed);
    const tablePda = getTablePda(profile, dbRoot, tableSeedBytes);
    const tableInfo = await connection.getAccountInfo(tablePda);

    if (!tableInfo) {
        throw new Error("table not found");
    }

    return {tablePda};
}

export async function fetchTableMeta(
    connection: Connection,
    profile: ProgramProfile,
    dbRootId: Uint8Array | string,
    tableSeed: Uint8Array | string,
) {
    const dbRootSeed = toSeedBytes(dbRootId);
    const dbRoot = getDbRootPda(profile, dbRootSeed);
    const tableSeedBytes = toSeedBytes(tableSeed);
    const tablePda = getTablePda(profile, dbRoot, tableSeedBytes);
    const info = await connection.getAccountInfo(tablePda);
    if (!info) {
        throw new Error("table not found");
    }

    return decodeTableMeta(info.data);
}

export async function fetchConnectionMeta(
    connection: Connection,
    profile: ProgramProfile,
    dbRootId: Uint8Array | string,
    connectionSeed: Uint8Array | string,
) {
    const dbRootSeed = toSeedBytes(dbRootId);
    const dbRoot = getDbRootPda(profile, dbRootSeed);
    const connectionSeedBytes = toSeedBytes(connectionSeed);
    const connectionTable = getConnectionTablePda(
        profile,
        dbRoot,
        connectionSeedBytes,
    );
    const info = await connection.getAccountInfo(connectionTable);
    if (!info) {
        throw new Error("connection table not found");
    }

    return decodeConnectionMeta(info.data);
}

export function evaluateConnectionAccess(
    meta: ReturnType<typeof decodeConnectionMeta>,
    signer: PublicKey) {
    let status: string = '';
    if (meta.status === CONNECTION_STATUS_PENDING) {
        status = "pending";
    } else if (meta.status === CONNECTION_STATUS_APPROVED) {
        status = "approved";
    } else if (meta.status === CONNECTION_STATUS_BLOCKED) {
        status = "blocked";
    }
    let signerIdx: number = -1;
    if (signer.equals(meta.partyA)) {
        signerIdx = 0;
    } else if (signer.equals(meta.partyB)) {
        signerIdx = 1;
    } else {
        return {
            allowed: false,
            status,
            message: "signer is not a connection participant",
        };
    }

    if (meta.status === CONNECTION_STATUS_APPROVED) {
        return {allowed: true, status};
    }

    if (meta.status === CONNECTION_STATUS_PENDING) {
        const message =
            signerIdx === meta.requester
                ? "Ask the other party to open the connection."
                : "Allow the connection in settings.";
        return {allowed: false, status, message};
    }
    if (meta.status === CONNECTION_STATUS_BLOCKED) {
        const blockerIdx =
            meta.blocker === CONNECTION_BLOCKER_NONE ? null : meta.blocker;
        const message =
            blockerIdx === signerIdx
                ? "Allow the connection in settings."
                : "Ask the other party to unblock the connection.";
        return {allowed: false, status, message};
    }

    return {allowed: false, status, message: "invalid connection status"};
}
