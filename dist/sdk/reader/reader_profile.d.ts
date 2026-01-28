export declare const resolveReadMode: (onChainPath: string, blockTime?: number | null) => {
    freshness?: "fresh" | "recent" | "archive";
};
export declare function decideReadMode(txSignature: string, mode?: string): Promise<{
    freshness?: "fresh" | "recent" | "archive";
}>;
