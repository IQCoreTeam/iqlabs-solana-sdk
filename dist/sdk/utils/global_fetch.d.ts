import { Connection, PublicKey } from "@solana/web3.js";
export declare function decodeTableMeta(data: Buffer): {
    columns: string[];
    idCol: string;
    gateMint: PublicKey;
    writers: PublicKey[];
};
export declare function decodeConnectionMeta(data: Buffer): {
    dbRootId: string;
    columns: string[];
    idCol: string;
    extKeys: string[];
    name: string;
    gateMint: PublicKey;
    partyA: PublicKey;
    partyB: PublicKey;
    status: number;
    requester: number;
    blocker: number;
};
export declare function ensureDbRootExists(connection: Connection, programId: PublicKey, dbRootId: Uint8Array | string): Promise<void>;
export declare function ensureTableExists(connection: Connection, programId: PublicKey, dbRootId: Uint8Array | string, tableSeed: Uint8Array | string): Promise<{
    tablePda: PublicKey;
}>;
export declare function fetchTableMeta(connection: Connection, programId: PublicKey, dbRootId: Uint8Array | string, tableSeed: Uint8Array | string): Promise<{
    columns: string[];
    idCol: string;
    gateMint: PublicKey;
    writers: PublicKey[];
}>;
export declare function fetchConnectionMeta(connection: Connection, programId: PublicKey, dbRootId: Uint8Array | string, connectionSeed: Uint8Array | string): Promise<{
    dbRootId: string;
    columns: string[];
    idCol: string;
    extKeys: string[];
    name: string;
    gateMint: PublicKey;
    partyA: PublicKey;
    partyB: PublicKey;
    status: number;
    requester: number;
    blocker: number;
}>;
export declare function evaluateConnectionAccess(meta: ReturnType<typeof decodeConnectionMeta>, signer: PublicKey): {
    allowed: boolean;
    status: string;
    message: string;
} | {
    allowed: boolean;
    status: string;
    message?: undefined;
};
