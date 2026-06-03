/**
 * Promise.allSettled with a concurrency cap to avoid browser ERR_INSUFFICIENT_RESOURCES
 * when bulk operations fan out hundreds of parallel HTTP requests.
 *
 * @template T,R
 * @param {T[]} items
 * @param {(item: T, index: number) => Promise<R>} handler
 * @param {number} [concurrency=6]
 * @returns {Promise<PromiseSettledResult<R>[]>}
 */
export async function allSettledWithConcurrency(items, handler, concurrency = 6) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) break;
      try {
        const value = await handler(items[index], index);
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}
