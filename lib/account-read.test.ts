import assert from "node:assert/strict";
import test from "node:test";
import { readAccount, readAssetPage, type AssetRow } from "./chain-read.ts";
const asset = (id: string): AssetRow => ({ id, name: id, symbol: "OLD", decimals: 8, frozen: false });
function mock(failed: string[] = []) {
  const at = { consts: { balances: { existentialDeposit: "10" } }, query: {
    system: { account: async () => ({ data: { free: "1000", reserved: "0", frozen: "0" } }) },
    assets: {
      account: async (id: string) => { if (failed.includes(id)) throw Error("RPC failed"); return id === "0" ? { isNone: true } : { unwrap: () => ({ balance: "200" }) }; },
      metadata: async () => ({ symbol: { toUtf8: () => "NOW" }, decimals: { toNumber: () => 2 } }),
    },
  } };
  const pins: string[] = [];
  const api = { rpc: { chain: { getFinalizedHead: async () => ({ toHex: () => "0x1234" }), getHeader: async () => ({ number: "42" }) } }, at: async (hash: string) => { pins.push(hash); return at; } };
  return { api: api as unknown as Parameters<typeof readAccount>[0], pins };
}
test("failed balance reads remain partial and cannot establish an empty portfolio", async () => {
  const { api } = mock(["1"]);
  const result = await readAccount(api, "owner", [asset("1")]);
  assert.equal(result.error, null); assert.equal(result.spendable, "990");
  assert.equal(result.holdingsComplete, false); assert.deepEqual(result.failedAssets, ["1"]); assert.match(result.coverageNote!, /failed/);
});
test("account balances and positive-holding precision use the same finalized snapshot", async () => {
  const { api, pins } = mock(); const result = await readAccount(api, "owner", [asset("1")]);
  assert.deepEqual(pins, ["0x1234"]); assert.equal(result.blockNumber, "42");
  assert.equal(result.holdings[0].symbol, "NOW"); assert.equal(result.holdings[0].decimals, 2); assert.equal(result.holdingsComplete, true);
});
test("successful reads cannot imply completeness while asset discovery is partial", async () => {
  const result = await readAccount(mock().api, "owner", [asset("0")], undefined, false);
  assert.deepEqual(result.holdings, []); assert.equal(result.holdingsComplete, false); assert.match(result.coverageNote!, /discovery/);
});
test("asset discovery enumerates sparse asset keys including assets without a name", async () => {
  const queried: string[] = [];
  const api = { rpc: { chain: { getFinalizedHead: async () => ({ toHex: () => "0x4567" }) } }, at: async () => ({ query: { assets: {
    asset: { entriesPaged: async () => [[{ args: ["9001"], toHex: () => "0xab" }, {}]] },
    metadata: async (id: string) => { queried.push(id); return { decimals: { toNumber: () => 0 }, isFrozen: { isTrue: false } }; },
  } } }) };
  const page = await readAssetPage(api as unknown as Parameters<typeof readAssetPage>[0]);
  assert.deepEqual(queried, ["9001"]); assert.equal(page.rows[0].name, "Unnamed"); assert.equal(page.rows[0].id, "9001"); assert.equal(page.complete, true);
});
