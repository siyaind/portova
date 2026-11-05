import assert from "node:assert/strict";
import test from "node:test";
import { exportReceipts, importReceipts, mergeReceipts, mergeLiveReceipts, commitReceiptImport, TX_STORAGE_KEY, parseTxs, patchTx, type TrackedTx } from "./tx-storage.ts";
import { TESTNET_GENESIS } from "./network.ts";
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

test("repeated imports are idempotent for cancelled attempts without a hash, including re-export", () => {
  const cancelled: TrackedTx = { id: "cancelled-attempt", label: "Swap", status: "ambiguous", error: "Cancelled", createdAt: 1234, genesisHash: genesis };
  const backup = exportReceipts([cancelled], genesis);
  const first = importReceipts(backup, genesis);
  assert.equal(mergeReceipts([cancelled], first).length, 1);
  assert.equal(mergeReceipts(first, importReceipts(backup, genesis)).length, 1);
  assert.equal(mergeReceipts(first, importReceipts(exportReceipts(first, genesis), genesis)).length, 1);
  assert.equal(first[0].status, "ambiguous");
  assert.equal(mergeReceipts(first, importReceipts(exportReceipts([{...cancelled, id:"different-attempt"}], genesis), genesis)).length, 2);
});

test("legacy V3 receipts without genesis match a network-scoped backup on its first import", () => {
  const legacy: TrackedTx[] = Array.from({length:24}, (_,i)=>({id:`legacy-${i}`,label:`Attempt ${i}`,status:i<18?"finalized":"ambiguous",hash:i<18?`0x${i.toString(16).padStart(64,"0")}`:undefined,createdAt:i,actualFee:i<18?"100":undefined}));
  let raw = JSON.stringify(legacy);
  const storage = {getItem:(key:string)=>{assert.equal(key,TX_STORAGE_KEY);return raw;},setItem:(_key:string,value:string)=>{raw=value;}};
  const backup = exportReceipts(legacy, TESTNET_GENESIS);
  const first = commitReceiptImport(storage,legacy,importReceipts(backup,TESTNET_GENESIS));
  assert.equal(first.added,0); assert.equal(first.items.length,24);
  assert.equal(first.items.find(item=>item.id==="legacy-0")?.actualFee,"100");
  assert.equal(commitReceiptImport(storage,first.items,importReceipts(backup,TESTNET_GENESIS)).added,0);
  const more = importReceipts(exportReceipts([...legacy,{id:"new-attempt",label:"New",status:"ambiguous"}],TESTNET_GENESIS),TESTNET_GENESIS);
  const added = commitReceiptImport(storage,first.items,more);
  assert.equal(added.added,1); assert.equal(JSON.parse(raw).length,25);
});

test("legacy duplicate aliases converge during persistence without dropping distinct attempts or mixing explicit networks", () => {
  const legacy: TrackedTx = {id:"original",label:"Cancelled",status:"ambiguous",createdAt:1};
  const imported = importReceipts(exportReceipts([legacy],TESTNET_GENESIS),TESTNET_GENESIS)[0];
  const distinct = {...legacy,id:"another-attempt"};
  assert.equal(mergeLiveReceipts([legacy,imported,distinct],[]).length,2);
  const withHash = {...legacy,hash,status:"finalized" as const,actualFee:"100"};
  const importedHash = importReceipts(exportReceipts([withHash],TESTNET_GENESIS),TESTNET_GENESIS)[0];
  const merged = mergeLiveReceipts([withHash,importedHash],[]);
  assert.equal(merged.length,1); assert.equal(merged[0].status,"finalized"); assert.equal(merged[0].actualFee,"100");
  assert.equal(mergeLiveReceipts([withHash],[{...withHash,genesisHash:genesis}]).length,2);
});

test("an import storage failure never reports a successful committed count", () => {
  const storage = {getItem:()=>null,setItem:()=>{throw Error("quota");}};
  assert.throws(()=>commitReceiptImport(storage,[],importReceipts(exportReceipts([row],genesis),genesis)),/quota/);
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
