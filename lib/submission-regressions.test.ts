import assert from "node:assert/strict";
import test from "node:test";
import { patchTx, parseTxs } from "./tx-storage.ts";
import { outcomeAfterWait } from "./tx-result.ts";
import { depositMinimumError } from "./liquidity-checks.ts";
import { checkAssetMint, checkNftMint } from "./mint-checks.ts";
import { saveProjectVersion } from "./project.ts";
import type { ApiPromise } from "@polkadot/api";
const hash = `0x${"a".repeat(64)}`;
test("pending-to-finalized recovery clears obsolete pool errors, including legacy reloads", () => {
  const previous = { id: "one", label: "Mint", status: "submitted" as const, hash, error: "The extrinsic is still in the node pool." };
  assert.equal(patchTx(previous, outcomeAfterWait({ hash, sawIncluded: false, chain: "finalized" })).error, undefined);
  assert.equal(parseTxs(JSON.stringify([{ ...previous, status: "finalized" }]))[0].error, undefined);
});
test("deposit minimum uses resulting pool balance and rejects a tiny initial deposit", () => {
  assert.match(depositMinimumError(1n, 0n, 10n)!, /minimum/);
  assert.equal(depositMinimumError(1n, 10n, 10n), null);
  assert.match(depositMinimumError(0n, 10n, 10n)!, /above zero/);
});
const json = (value: unknown) => ({ toJSON: () => value });
const fake = (query: unknown) => ({ rpc: { chain: { getFinalizedHead: async () => hash } }, at: async () => ({ query }) }) as unknown as ApiPromise;
test("non-issuer token mint refuses before any signer is needed", async () => {
  await assert.rejects(checkAssetMint(fake({ assets: { asset: async () => json({ issuer: "wrong", status: "Live" }) } }), "1", "different"), /issuer/);
});
test("duplicate NFT IDs refuse before fee and wallet requests", async () => {
  const api = fake({ nfts: { item: async () => json({ owner: "x" }), collection: async () => json({ items: 1 }), collectionConfigOf: async () => json({}), collectionRoleOf: async () => json(1) } });
  await assert.rejects(checkNftMint(api, "11", 0, "alice"), /already exists/);
});
test("issuer-only NFT collections refuse a non-issuer", async () => {
  const api = fake({ nfts: { item: async () => json(null), collection: async () => json({ items: 1 }), collectionConfigOf: async () => json({ maxSupply: 3, mintSettings: { mintType: "Issuer" } }), collectionRoleOf: async () => json(null) } });
  await assert.rejects(checkNftMint(api, "11", 2, "alice"), /issuer/);
});
test("a guided draft retains its original revision and cannot overwrite a newer save", () => {
  const original = { id: "p", revision: 1, name: "Original", assetId: "", collectionId: "", poolLpToken: "", proceeds: "" };
  const saved = saveProjectVersion(original, { ...original, name: "Newer" });
  assert.throws(() => saveProjectVersion(saved, { ...original, name: "Stale draft" }), /another tab/);
});

test("NFT preflight accepts the runtime object-shaped issuer enum", async () => {
  const api = fake({ nfts: { item: async () => json(null), collection: async () => json({ items: 1 }), collectionConfigOf: async () => json({ maxSupply: 3, mintSettings: { mintType: { issuer: null } } }), collectionRoleOf: async () => json(7) }, system: { number: async () => 123 } });
  await checkNftMint(api, "11", 2, "issuer");
});
