export const createRateLimiter = (maxRps: number) => {
    if (maxRps <= 0) {
        return null;
    }
    const minDelayMs = Math.max(1, Math.ceil(1000 / maxRps));
    let nextTime = 0;

    return {
        wait: async () => {
            const now = Date.now();
            const scheduled = Math.max(now, nextTime);
            nextTime = scheduled + minDelayMs;
            const delay = scheduled - now;
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        },
    };
};
