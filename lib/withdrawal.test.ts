import assert from "node:assert/strict";
import test from "node:test";
import { encodeAddress } from "@polkadot/util-crypto";
import { guardedWallet, prepareWithdrawal, sameAccount, withdrawalStillCurrent } from "./withdrawal.ts";

const alice = encodeAddress(new Uint8Array(32).fill(1), 42);
const bob = encodeAddress(new Uint8Array(32).fill(2), 42);
const genesis = `0x${"ab".repeat(32)}`;
const context = { account: alice, source: "test-wallet", proceeds: alice, genesisHash: genesis, live: true };

test("withdrawal requires the proceeds authority, verified network, recipient and exact positive amount", () => {
  const request = prepareWithdrawal(context, bob, "0.00000000000001", genesis);
  assert.notEqual(typeof request, "string");
  if (typeof request === "string") return;
  assert.equal(request.amount, 1n);
  for (const amount of ["0", "-1", "1e4", "1.000000000000001", "999999999999999999999999999999999999999"]) {
    assert.equal(typeof prepareWithdrawal(context, bob, amount, genesis), "string");
  }
  for (const destination of [alice, "0x1234", encodeAddress(new Uint8Array(32).fill(2), 0)]) {
    assert.equal(typeof prepareWithdrawal(context, destination, "1", genesis), "string");
  }
  assert.equal(typeof prepareWithdrawal({ ...context, account: bob }, alice, "1", genesis), "string");
  assert.equal(typeof prepareWithdrawal({ ...context, live: false }, bob, "1", genesis), "string");
  assert.equal(typeof prepareWithdrawal({ ...context, genesisHash: "other" }, bob, "1", genesis), "string");
  assert.equal(sameAccount(alice, encodeAddress(new Uint8Array(32).fill(1), 0)), true);
});

test("account, extension, network and draft changes invalidate an earlier withdrawal review", () => {
  const request = prepareWithdrawal(context, bob, "1", genesis);
  if (typeof request === "string") throw Error(request);
  assert.equal(withdrawalStillCurrent(request, context, bob, "1.0"), true);
  for (const changed of [{ ...context, account: bob }, { ...context, source: "other" }, { ...context, proceeds: bob }, { ...context, genesisHash: "other" }]) {
    assert.equal(withdrawalStillCurrent(request, changed, bob, "1"), false);
  }
  assert.equal(withdrawalStillCurrent(request, context, bob, "2"), false);
});

test("account switching during wallet permission resolution prevents submission", async () => {
  let current = true, sent = false;
  await assert.rejects(guardedWallet({ current: () => current, open: async () => { current = false; return {}; }, submit: async () => { sent = true; } }), /Nothing was submitted/);
  assert.equal(sent, false);
  await assert.rejects(guardedWallet({ current: () => true, open: async () => { throw Error("Permission rejected"); }, submit: async () => { sent = true; } }), /Permission rejected/);
  assert.equal(sent, false);
});
