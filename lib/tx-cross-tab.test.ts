import assert from "node:assert/strict";
import test from "node:test";
import { mergeLiveReceipts, parseTxs, importReceipts, exportReceipts, patchTx, type TrackedTx } from "./tx-storage.ts";
const hash = `0x${"a".repeat(64)}`, genesis = `0x${"b".repeat(64)}`;
const row: TrackedTx = { id: "one", label: "Create", status: "submitted", hash, genesisHash: genesis, createdAt: 1, updatedAt: 1 };
test("concurrent receipt tabs preserve unrelated records and the newest receipt fields", () => {
  const merged = mergeLiveReceipts([row, { ...row, id: "two", hash: `0x${"c".repeat(64)}` }], [{ ...row, status: "finalized", actualFee: "100", updatedAt: 2 }]);
  assert.equal(merged.length, 2); assert.equal(merged.find(item => item.id === "one")?.status, "finalized");
  assert.equal(mergeLiveReceipts(merged, [row]).find(item => item.id === "one")?.actualFee, "100");
});
test("a newer stale-tab update cannot demote a verified receipt", () => {
  const merged = mergeLiveReceipts([{ ...row, status: "finalized", updatedAt: 2 }], [{ ...row, status: "included", updatedAt: 3 }]);
  assert.equal(merged[0].status, "finalized");
  const reversed = mergeLiveReceipts([{ ...row, status: "included", updatedAt: 3 }], [{ ...row, status: "finalized", updatedAt: 2 }]);
  assert.equal(reversed[0].status, "finalized");
});
test("live tab synchronization preserves an active signature while reload treats it as unknown", () => {
  const raw = JSON.stringify([{ ...row, status: "signing", hash: undefined }]);
  assert.equal(parseTxs(raw, false)[0].status, "signing"); assert.equal(parseTxs(raw)[0].status, "ambiguous");
});
test("imported receipts cannot auto-link a project or carry a forged future merge revision", () => {
  const raw = exportReceipts([{ ...row, projectId: "project", projectField: "assetId", objectId: "1", updatedAt: Number.MAX_SAFE_INTEGER }], genesis);
  const imported = importReceipts(raw, genesis)[0];
  assert.equal(imported.projectId, undefined); assert.equal(imported.projectField, undefined); assert.equal(imported.objectId, undefined); assert.ok(imported.updatedAt! < Number.MAX_SAFE_INTEGER);
});
test("a late inconclusive recovery cannot erase settled fee, signer or inclusion evidence", () => {
  const settled: TrackedTx = { ...row, status: "finalized", account: "verified-signer", actualFee: "100", blockNumber: 42, extrinsicIndex: 1 };
  const next = patchTx(settled, { actualFee: undefined, account: undefined, blockNumber: undefined, checkedAt: 123 });
  assert.equal(next.actualFee, "100"); assert.equal(next.account, "verified-signer"); assert.equal(next.blockNumber, 42); assert.equal(next.checkedAt, 123);
});
