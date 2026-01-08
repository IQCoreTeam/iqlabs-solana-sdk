export const runWithConcurrency = async <T>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<void>,
) => {
    if (items.length === 0) {
        return;
    }
    const concurrency = Math.max(1, Math.min(limit, items.length));
    let cursor = 0;
    const runners = Array.from({length: concurrency}, async () => {
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
