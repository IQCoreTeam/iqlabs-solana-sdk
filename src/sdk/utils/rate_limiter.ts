export const createRateLimiter = (maxRps: number) => {
    if (maxRps <= 0) {
        return null;
    }
    const baseDelayMs = Math.max(1, Math.ceil(1000 / maxRps));
    let minDelayMs = baseDelayMs;
    let nextTime = 0;

    return {
        wait: async () => {
            // creep back toward the configured rate after throttle() backoffs
            minDelayMs = Math.max(baseDelayMs, minDelayMs * 0.98);
            const now = Date.now();
            const scheduled = Math.max(now, nextTime);
            nextTime = scheduled + minDelayMs;
            const delay = scheduled - now;
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        },
        /** Rate-limit response seen: halve the send rate, floored at 1 rps. */
        throttle: () => {
            minDelayMs = Math.min(1000, minDelayMs * 2);
        },
    };
};
