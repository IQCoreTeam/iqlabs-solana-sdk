export declare function readCodeIn(txSignature: string, speed?: string, onProgress?: (percent: number) => void): Promise<{
    metadata: string;
    data: string | null;
}>;
