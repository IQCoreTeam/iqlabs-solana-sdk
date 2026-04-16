import { Connection, PublicKey } from "@solana/web3.js";
export declare function readConnection(dbRootId: Uint8Array<any> | string, partyA: string, partyB: string): Promise<{
    status: "pending" | "approved" | "blocked" | "unknown";
    requester: "a" | "b";
    blocker: "a" | "b" | "none";
}>;
export declare function getTablelistFromRoot(connection: Connection, dbRootId: Uint8Array | string): Promise<{
    rootPda: PublicKey;
    creator: string | null;
    tableSeeds: any;
    globalTableSeeds: any;
}>;
export declare function readTableRows(account: PublicKey | string, options?: {
    before?: string;
    limit?: number;
    signatures?: string[];
    speed?: string;
}): Promise<Array<Record<string, unknown>>>;
export declare function collectSignatures(account: PublicKey | string, maxSignatures?: number): Promise<string[]>;
