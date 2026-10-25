export type StorageKey = { args: Array<{ toString(): string }>; toHex(): string };
export type StoragePageQuery<T> = { entriesPaged(options: { args: unknown[]; pageSize: number; startKey?: string }): Promise<Array<[StorageKey, T]>> };
export async function storagePage<T>(query: StoragePageQuery<T>, cursor?: string | null, pageSize = 64) {
  if (cursor && !/^0x[0-9a-fA-F]+$/.test(cursor)) throw Error("Invalid storage cursor.");
  const size = Math.max(1, Math.min(Math.trunc(pageSize) || 64, 128));
  if (typeof query.entriesPaged !== "function") throw Error("The node cannot enumerate this storage map in pages. Discovery is unavailable.");
  const entries = await query.entriesPaged({ args: [], pageSize: size, ...(cursor ? { startKey: cursor } : {}) });
  const nextCursor = entries.length === size ? entries.at(-1)![0].toHex() : null;
  if (nextCursor && nextCursor === cursor) throw Error("The node returned a storage page that did not advance.");
  return { entries, nextCursor, complete: nextCursor === null };
}
