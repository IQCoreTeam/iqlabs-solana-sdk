import { Connection, PublicKey, type Signer } from "@solana/web3.js";
import { type SignerInput } from "../utils/wallet";
import { GateType } from "../../contract";
export declare function createTable(connection: Connection, signer: Signer, dbRootId: Uint8Array | string, tableSeed: Uint8Array | string, tableName: Uint8Array | string, columnNames: Array<Uint8Array | string>, idCol: Uint8Array | string, extKeys: Array<Uint8Array | string>, gate?: {
    mint: PublicKey;
    amount?: number;
    gateType?: GateType;
}, writers?: PublicKey[], tableHint?: Uint8Array | string): Promise<string>;
export declare function validateRowJson(connection: Connection, programId: PublicKey, dbRootId: Uint8Array | string, tableSeed: Uint8Array | string, rowJson: string, idCol?: string): Promise<{
    columns: string[];
    idCol: string;
    name: string;
    gate: {
        mint: PublicKey;
        amount: {
            toNumber(): number;
        };
        gateType: number;
    };
    writers: PublicKey[];
}>;
export declare function resolveSignerAta(connection: Connection, signer: SignerInput, gateMint: PublicKey): Promise<PublicKey | null>;
export declare function writeRow(connection: Connection, signer: SignerInput, dbRootId: Uint8Array | string, tableSeed: Uint8Array | string, rowJson: string, skipConfirmation?: boolean, remainingAccounts?: PublicKey[]): Promise<string>;
export declare function writeConnectionRow(connection: Connection, signer: SignerInput, dbRootId: Uint8Array | string, connectionSeed: Uint8Array | string, rowJson: string): Promise<string>;
export declare function manageRowData(connection: Connection, signer: SignerInput, dbRootId: Uint8Array | string, seed: Uint8Array | string, rowJson: string, tableName?: string | Uint8Array, targetTx?: string | Uint8Array): Promise<string>;
export declare function updateUserMetadata(connection: Connection, signer: SignerInput, dbRootId: Uint8Array | string, meta: Uint8Array | string): Promise<string>;
export declare function requestConnection(connection: Connection, signer: SignerInput, dbRootId: Uint8Array | string, partyA: string, partyB: string, tableName: string | Uint8Array, columns: Array<string | Uint8Array>, idCol: string | Uint8Array, extKeys: Array<string | Uint8Array>): Promise<string>;
