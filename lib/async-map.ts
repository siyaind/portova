/** Preserve order while bounding RPC fan-out. A failure is never turned into an empty result. */
export async function mapBounded<T, U>(items: readonly T[], limit: number, read: (item: T, index: number) => Promise<U>): Promise<U[]> {
  const result: U[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      result[index] = await read(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, Math.trunc(limit))) }, worker));
  return result;
}
