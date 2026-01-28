import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
export declare function readInventoryMetadata(txSignature: string): Promise<{
    onChainPath: string;
    metadata: string;
}>;
export declare const fetchInventoryTransactions: (publicKey: PublicKey, limit: number, before?: string) => Promise<any[]>;
export declare function readSession(sessionPubkey: string, readOption: {
    freshness?: "fresh" | "recent" | "archive";
}, speed?: string, mode?: string, onProgress?: (percent: number) => void): Promise<{
    result: string | null;
}>;
export declare function readLinkedListFromTail(tailTx: string, readOption: {
    freshness?: "fresh" | "recent" | "archive";
}, mode?: string, onProgress?: (percent: number) => void, expectedTotalChunks?: number): Promise<{
    result: string;
}>;
export declare function readUserInventoryCodeInFromTx(tx: VersionedTransactionResponse, speed?: string, mode?: string, onProgress?: (percent: number) => void): Promise<{
    metadata: string;
    data: string | null;
}>;
export declare function readUserState(userPubkey: string, mode?: string): Promise<{
    owner: string;
    metadata: string | null;
    totalSessionFiles: bigint;
    profileData?: string;
}>;
