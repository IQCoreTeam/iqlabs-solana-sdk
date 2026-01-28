export declare const runWithConcurrency: <T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) => Promise<void>;
