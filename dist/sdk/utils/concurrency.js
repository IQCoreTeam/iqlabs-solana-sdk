"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWithConcurrency = void 0;
const runWithConcurrency = async (items, limit, worker) => {
    if (items.length === 0) {
        return;
    }
    const concurrency = Math.max(1, Math.min(limit, items.length));
    let cursor = 0;
    const runners = Array.from({ length: concurrency }, async () => {
        while (true) {
            const index = cursor;
            cursor += 1;
            if (index >= items.length) {
                return;
            }
            await worker(items[index], index);
        }
    });
    await Promise.all(runners);
};
exports.runWithConcurrency = runWithConcurrency;
