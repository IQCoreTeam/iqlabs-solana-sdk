import { Connection, PublicKey } from "@solana/web3.js";
export declare function readConnection(dbRootId: Uint8Array<any> | string, partyA: string, partyB: string, mode?: string): Promise<{
    status: "pending" | "approved" | "blocked" | "unknown";
    requester: "a" | "b";
    blocker: "a" | "b" | "none";
}>;
export declare function getTablelistFromRoot(connection: Connection, dbRootId: Uint8Array | string, mode?: string): Promise<{
    rootPda: PublicKey;
    creator: string;
    tableSeeds: any;
    globalTableSeeds: any;
}>;
export declare function readTableRows(account: PublicKey | string, options?: {
    before?: string;
    limit?: number;
    speed?: string;
}): Promise<Array<Record<string, unknown>>>;
