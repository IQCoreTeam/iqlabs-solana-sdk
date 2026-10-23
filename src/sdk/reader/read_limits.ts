/** Optional work limits for reading an untrusted inscription. */
export interface ReadLimits {
    maxBytes?: number;
    maxChunks?: number;
    maxHistoryTransactions?: number;
}

export class ReadLimitError extends Error {
    constructor(limit: keyof ReadLimits) {
        super(`Inscription read limit exceeded: ${limit}`);
        this.name = "ReadLimitError";
    }
}

/** One budget follows a read through bulk fallback and chunk assembly. */
export class ReadBudget {
    private transactions = 0;
    private chunks = 0;
    private bytes = 0;
    private failure: ReadLimitError | null = null;

    constructor(private readonly limits: ReadLimits = {}) {
        for (const [name, value] of Object.entries(limits)) {
            if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0))
                throw new Error(`Invalid inscription read limit: ${name}`);
        }
    }

    assertActive(): void {
        if (this.failure) throw this.failure;
    }

    private check(limit: keyof ReadLimits, value: number): void {
        this.assertActive();
        if (this.limits[limit] !== undefined && value > this.limits[limit]!) {
            this.failure = new ReadLimitError(limit);
            throw this.failure;
        }
    }

    pageSize(preferred: number): number {
        this.assertActive();
        const maximum = this.limits.maxHistoryTransactions;
        if (maximum === undefined) return preferred;
        this.check("maxHistoryTransactions", this.transactions + 1);
        return Math.min(preferred, maximum - this.transactions);
    }

    addTransactions(count: number): void {
        this.check("maxHistoryTransactions", this.transactions + count);
        this.transactions += count;
    }

    checkChunkCount(count: number): void {
        this.check("maxChunks", count);
    }

    addChunk(chunk: string): void {
        this.checkChunkCount(this.chunks + 1);
        const bytes = this.bytes + Buffer.byteLength(chunk, "utf8");
        this.check("maxBytes", bytes);
        this.chunks++;
        this.bytes = bytes;
    }
}
