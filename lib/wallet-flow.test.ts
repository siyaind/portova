import assert from "node:assert/strict";
import test from "node:test";
import type { ApiPromise } from "@polkadot/api";
import type { Signer } from "@polkadot/types/types";
import { signAndSend, type TxUpdate } from "./assets.ts";
const hash = `0x${"ab".repeat(32)}`;
const blockHash = `0x${"cd".repeat(32)}`;
type Tx = Parameters<typeof signAndSend>[1];
type Callback = Parameters<Tx["signAndSend"]>[2];
const api = {} as ApiPromise, signer = {} as Signer;
const result = (index = 0, successIndex = 0) => ({
  txHash: { toHex: () => hash }, txIndex: index,
  status: { isFinalized: true, isInBlock: false, isBroadcast: false, isReady: false, isDropped: false, isInvalid: false, isUsurped: false, type: "Finalized", asFinalized: { toHex: () => blockHash } },
  events: [{ phase: { isApplyExtrinsic: true, asApplyExtrinsic: { toNumber: () => successIndex } }, event: { section: "system", method: "ExtrinsicSuccess", data: [] } }],
});

test("wallet rejection propagates without broadcasting", async () => {
  let broadcasts = 0;
  const tx = { signAndSend: async () => { broadcasts++; return () => {}; }, signAsync: async () => { throw Error("User rejected request"); } };
  await assert.rejects(signAndSend(api, tx, "alice", signer, () => {}, undefined, async () => true), /User rejected/);
  assert.equal(broadcasts, 0);
});

test("a changed account or expired review after signing never reaches send", async () => {
  let broadcasts = 0;
  const tx = { signAndSend: async () => () => {}, signAsync: async () => ({ send: async () => { broadcasts++; return () => {}; } }) };
  const outcome = await signAndSend(api, tx, "alice", signer, () => {}, undefined, async () => false);
  assert.equal(outcome.status, "ambiguous");
  assert.equal(outcome.hash, undefined);
  assert.equal(broadcasts, 0);
});

test("finalized dispatch saves its location and ignores late subscription callbacks", async () => {
  const updates: TxUpdate[] = [];
  let callback!: Callback, unsubscribed = false;
  const tx: Tx = { signAndSend: async (_address, _options, cb) => { callback = cb; cb(result()); return () => { unsubscribed = true; }; } };
  const outcome = await signAndSend(api, tx, "alice", signer, (update) => updates.push(update));
  assert.equal(outcome.status, "finalized");
  assert.equal(outcome.blockHash, blockHash);
  assert.equal(outcome.extrinsicIndex, 0);
  callback({ ...result(), status: { ...result().status, isFinalized: false, isReady: true } });
  assert.equal(updates.length, 1);
  assert.equal(unsubscribed, true);
});

test("another extrinsic's success cannot confirm this transaction", async () => {
  const tx: Tx = { signAndSend: async (_a, _o, callback) => { callback(result(1, 0)); return () => {}; } };
  assert.equal((await signAndSend(api, tx, "alice", signer, () => {})).status, "ambiguous");
});
