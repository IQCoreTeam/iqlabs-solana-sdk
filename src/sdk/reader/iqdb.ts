import {Connection, PublicKey} from "@solana/web3.js";

import {
    CONNECTION_STATUS_APPROVED,
    CONNECTION_STATUS_BLOCKED,
    CONNECTION_STATUS_PENDING,
    getConnectionTablePda,
    getDbRootPda,
} from "../../contract";
import {DEFAULT_CONTRACT_MODE} from "../../constants";
import {getConnection} from "../utils/connection_helper";
import {decodeConnectionMeta} from "../utils/global_fetch";
import {createRateLimiter} from "../utils/rate_limiter";
import {resolveSessionSpeed, SESSION_SPEED_PROFILES} from "../utils/session_speed";
import {deriveDmSeed, toSeedBytes} from "../utils/seed";
import {readCodeIn} from "./read_code_in";
import {readerContext, resolveReaderProgramId} from "./reader_context";
import {fetchAccountTransactions} from "./reader_utils";

const resolveConnectionStatus = (status: number) => {
    if (status === CONNECTION_STATUS_PENDING) {
        return "pending";
    }
    if (status === CONNECTION_STATUS_APPROVED) {
        return "approved";
    }
    if (status === CONNECTION_STATUS_BLOCKED) {
        return "blocked";
    }
    return "unknown";
};

export async function readConnection(
    dbRootId: Uint8Array<any> | string,
    partyA: string,
    partyB: string,
    mode: string = DEFAULT_CONTRACT_MODE,
): Promise<{
    status: "pending" | "approved" | "blocked" | "unknown";
    requester: "a" | "b";
    blocker: "a" | "b" | "none";
}> {
    const connection = getConnection();
    const dbRootSeed = toSeedBytes(dbRootId);
    const programId = resolveReaderProgramId(mode);
    const dbRoot = getDbRootPda(dbRootSeed, programId);
    const connectionSeed = deriveDmSeed(partyA, partyB);
    const connectionTable = getConnectionTablePda(
        dbRoot,
        connectionSeed,
        programId,
    );
    const info = await connection.getAccountInfo(connectionTable);
    if (!info) {
        throw new Error("connection table not found");
    }
    const meta = decodeConnectionMeta(info.data);
    const status = resolveConnectionStatus(meta.status);
    const requester = meta.requester === 0 ? "a" : "b";
    const blocker =
        meta.blocker === 0 ? "a" : meta.blocker === 1 ? "b" : "none";

    return {
        status: status as "pending" | "approved" | "blocked" | "unknown",
        requester,
        blocker,
    };
}

export async function getTablelistFromRoot(
    connection: Connection,
    dbRootId: Uint8Array | string,
    mode: string = DEFAULT_CONTRACT_MODE,
) {
    const programId = resolveReaderProgramId(mode);
    const dbRootSeed = toSeedBytes(dbRootId);
    const dbRoot = getDbRootPda(dbRootSeed, programId);
    const info = await connection.getAccountInfo(dbRoot);
    if (!info) {
        return {
            rootPda: dbRoot,
            creator: null,
            tableSeeds: [] as string[],
            globalTableSeeds: [] as string[],
        };
    }
    const decoded = readerContext.accountCoder.decode("DbRoot", info.data) as any;
    const creator = decoded?.creator
        ? new PublicKey(decoded.creator).toBase58()
        : null;
    const toHex = (value: any) => {
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
    const rawTableSeeds =
        decoded.table_seeds ??
        decoded.tableSeeds ??
        decoded.table_names ??
        decoded.tableNames ??
        [];
    const rawGlobalSeeds =
        decoded.global_table_seeds ??
        decoded.globalTableSeeds ??
        decoded.global_table_names ??
        decoded.globalTableNames ??
        [];
    const tableSeeds = rawTableSeeds.map((value: any) => toHex(value));
    const globalTableSeeds = rawGlobalSeeds.map((value: any) => toHex(value));
    return {
        rootPda: dbRoot,
        creator,
        tableSeeds,
        globalTableSeeds,
    };
}

///TODO we need to support the function that read the table's and instruction aswell and sort it, it will be good for
// make 2 function and call them by branch with mutable? option,  is that mutable, we need to sort , "I can change the word mutable if that's not awesome"
export async function readTableRows(
    account: PublicKey | string,
    options: { before?: string; limit?: number; speed?: string } = {},
): Promise<Array<Record<string, unknown>>> {
    const {before, limit, speed} = options;
    const signatures = await fetchAccountTransactions(account, {before, limit});
    const speedKey = resolveSessionSpeed(speed);
    const limiter = createRateLimiter(SESSION_SPEED_PROFILES[speedKey].maxRps);
    const rows: Array<Record<string, unknown>> = [];

    for (const sig of signatures) {
        if (limiter) {
            await limiter.wait();
        }
        let result: {data: string | null; metadata: string};//data { SESSIONPDA:NDJKFNDJNKFJAFDDSFADF} metadata{file name filetype etc
        try {
            result = await readCodeIn(sig.signature, speed);
        } catch (err) {
            if (
                err instanceof Error &&
                err.message.includes("user_inventory_code_in instruction not found")
            ) {
                continue;
            }
            throw err;
        }
        const {data, metadata} = result;
        if (!data) {
            rows.push({signature: sig.signature, metadata, data: null});
            continue;
        }
        try {
            const parsed = JSON.parse(data) as Record<string, unknown>;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                rows.push({...parsed, __txSignature: sig.signature});
                continue;
            }
        } catch {
            // fallthrough
        }
        rows.push({signature: sig.signature, metadata, data});
    }

    return rows;
}
