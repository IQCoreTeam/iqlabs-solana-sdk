export declare function readSessionResult(sessionPubkey: string, readOption: {
    freshness?: "fresh" | "recent" | "archive";
}, speed?: string, onProgress?: (percent: number) => void): Promise<{
    result: string;
}>;
export declare function readLinkedListResult(tailTx: string, readOption: {
    freshness?: "fresh" | "recent" | "archive";
}, onProgress?: (percent: number) => void, expectedTotalChunks?: number): Promise<{
    result: string;
}>;
