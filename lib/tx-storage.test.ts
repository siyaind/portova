import assert from "node:assert/strict";
import test from "node:test";
import { exportReceipts, importReceipts, mergeReceipts, parseTxs, patchTx, type TrackedTx } from "./tx-storage.ts";
import { receiptExplorerUrl, blockExplorerUrl } from "./explorer.ts";
const hash = `0x${"ab".repeat(32)}`, genesis = `0x${"cd".repeat(32)}`;
const row: TrackedTx = { id: "one", label: "Withdraw", status: "included", hash, genesisHash: genesis, blockNumber: 1, searchCursor: 50, fromBlock: 0 };

test("reload retains old receipts, inclusion hints and search progress beyond forty records", () => {
  const rows = Array.from({ length: 70 }, (_, i) => ({ ...row, id: `${i}`, searchCursor: i }));
  const loaded = parseTxs(JSON.stringify(rows));
  assert.equal(loaded.length, 70);
  assert.equal(loaded[69].searchCursor, 69);
  assert.equal(loaded[0].blockNumber, 1);
  assert.equal(parseTxs(JSON.stringify([{ id: "x", label: "Waiting", status: "signing" }]))[0].status, "ambiguous");
});

test("imported success claims are reverified and a different network is refused", () => {
  const imported = importReceipts(exportReceipts([{ ...row, status: "finalized" }], genesis), genesis);
  assert.equal(imported[0].status, "ambiguous");
  assert.equal(imported[0].blockNumber, 1);
  assert.throws(() => importReceipts(exportReceipts([row], hash), genesis), /connected network/);
  assert.equal(mergeReceipts([row], imported).length, 1);
  assert.equal(patchTx({ ...row, status: "finalized" }, { status: "submitted" }).status, "finalized");
  assert.equal(parseTxs(JSON.stringify([{ ...row, hash: "javascript:bad" }])).length, 0);
});

test("explorer links validate the full receipt or block identifier", () => {
  assert.equal(receiptExplorerUrl("javascript:bad"), null);
  assert.match(receiptExplorerUrl(hash)!, /#\/extrinsics\/0xab/);
  assert.equal(blockExplorerUrl(-1), null);
  assert.match(blockExplorerUrl(159687)!, /#\/blocks\/159687$/);
});

test("fee estimates survive reload while imported charged-fee claims require fresh chain evidence", () => {
  const receipt = { ...row, account: "unverified-account", estimatedFee: "100", feeBudget: "110", actualFee: "103", runtimeVersion: "portaldot-v3:3002", call: "balances.transferKeepAlive" };
  assert.equal(parseTxs(JSON.stringify([receipt]))[0].actualFee, "103");
  const imported = importReceipts(exportReceipts([receipt], genesis), genesis)[0];
  assert.equal(imported.estimatedFee, "100"); assert.equal(imported.actualFee, undefined);
  assert.equal(imported.account, undefined);
});
