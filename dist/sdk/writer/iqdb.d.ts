import { Connection, PublicKey, type Signer } from "@solana/web3.js";
export declare function validateRowJson(connection: Connection, programId: PublicKey, dbRootId: Uint8Array | string, tableSeed: Uint8Array | string, rowJson: string, idCol?: string): Promise<void>;
export declare function resolveSignerAta(connection: Connection, signer: Signer, gateMint?: PublicKey): Promise<PublicKey>;
export declare function writeRow(connection: Connection, signer: Signer, dbRootId: Uint8Array | string, tableSeed: Uint8Array | string, rowJson: string, mode?: string): Promise<string>;
export declare function writeConnectionRow(connection: Connection, signer: Signer, dbRootId: Uint8Array | string, connectionSeed: Uint8Array | string, rowJson: string, mode?: string): Promise<string>;
export declare function manageRowData(connection: Connection, signer: Signer, dbRootId: Uint8Array | string, seed: Uint8Array | string, rowJson: string, tableName?: string | Uint8Array, targetTx?: string | Uint8Array, mode?: string): Promise<string>;
export declare function requestConnection(connection: Connection, signer: Signer, dbRootId: Uint8Array | string, partyA: string, partyB: string, tableName: string | Uint8Array, columns: Array<string | Uint8Array>, idCol: string | Uint8Array, extKeys: Array<string | Uint8Array>, mode?: string): Promise<string>;
