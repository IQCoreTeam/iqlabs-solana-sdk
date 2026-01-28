export declare const createRateLimiter: (maxRps: number) => {
    wait: () => Promise<void>;
};
