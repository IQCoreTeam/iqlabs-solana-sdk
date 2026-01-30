"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = void 0;
const createRateLimiter = (maxRps) => {
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
exports.createRateLimiter = createRateLimiter;
