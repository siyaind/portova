import assert from "node:assert/strict";
import test from "node:test";
import type { ApiPromise } from "@polkadot/api";
import { readCollectionList } from "./nfts.ts";
import { readListingsPage, scanListings } from "./market.ts";
import { storagePage } from "./storage-page.ts";
const hash = `0x${"ab".repeat(32)}`;
function apiFor(total: number) {
  const pages: number[] = [];
  const entries = Array.from({ length: total }, (_, index) => [{ args: [String(1000 + index), String(9000 + index)], toHex: () => `0x${index.toString(16).padStart(64, "0")}` }, { isNone: false, unwrap: () => ({ owner: { toString: () => "owner" }, items: { toString: () => "1" }, toHuman: () => ({ price: "100" }) }) }] as const);
  const query = { entriesPaged: async ({ pageSize, startKey }: { pageSize: number; startKey?: string }) => { const start = startKey ? parseInt(startKey.slice(2), 16) + 1 : 0; pages.push(start); return entries.slice(start, start + pageSize); } };
  const api = { rpc: { chain: { getFinalizedHead: async () => ({ toHex: () => hash }) } }, at: async (value: string) => { assert.equal(value, hash); return { query: { nfts: { collection: query, itemPriceOf: query, item: async () => ({ isNone: true }) } } }; } } as unknown as ApiPromise;
  return { api, pages };
}
test("collection discovery enumerates sparse IDs beyond 100 and every storage page", async () => {
  const { api, pages } = apiFor(130);
  const rows = await readCollectionList(api);
  assert.equal(rows.length, 130); assert.equal(rows.at(-1)?.id, "1129"); assert.deepEqual(pages, [0, 64, 128]);
});
test("listing discovery has no first-20-collection or item-23 limit and reports partial coverage", async () => {
  const { api } = apiFor(130);
  const page = await readListingsPage(api);
  assert.equal(page.rows[0].itemId, "9000"); assert.equal(page.complete, false); assert.equal(page.scanned, 64);
  assert.equal((await scanListings(api, Array.from({ length: 130 }, (_, i) => String(1000 + i)))).length, 130);
});
test("unsupported enumeration and a stalled cursor fail explicitly instead of probing a hidden subset", async () => {
  await assert.rejects(storagePage({} as never), /unavailable/);
  await assert.rejects(storagePage({ entriesPaged: async () => [[{ args: [], toHex: () => "0xaa" }, {}]] }, "0xaa", 1), /did not advance/);
});
