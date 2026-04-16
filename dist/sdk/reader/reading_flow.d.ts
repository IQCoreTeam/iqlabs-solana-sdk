import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
export declare function readInventoryMetadata(txSignature: string): Promise<{
    onChainPath: string;
    metadata: string;
}>;
export declare const fetchInventoryTransactions: (publicKey: PublicKey, limit: number, before?: string) => Promise<{
    onChainPath: string;
    metadata: string;
    signature: string;
    slot: number;
    err: import("@solana/web3.js").TransactionError | null;
    memo: string | null;
    blockTime?: number | null;
    confirmationStatus?: import("@solana/web3.js").TransactionConfirmationStatus;
}[]>;
export declare function readSession(sessionPubkey: string, readOption: {
    freshness?: "fresh" | "recent" | "archive";
}, speed?: string, onProgress?: (percent: number) => void): Promise<{
    result: string | null;
}>;
export declare function readLinkedListFromTail(tailTx: string, readOption: {
    freshness?: "fresh" | "recent" | "archive";
}, onProgress?: (percent: number) => void, expectedTotalChunks?: number): Promise<{
    result: string;
}>;
export declare function readUserInventoryCodeInFromTx(tx: VersionedTransactionResponse, speed?: string, onProgress?: (percent: number) => void): Promise<{
    metadata: string;
    data: string | null;
}>;
export declare function readUserState(userPubkey: string): Promise<{
    owner: string;
    metadata: string | null;
    totalSessionFiles: bigint;
    profileData?: string;
}>;
