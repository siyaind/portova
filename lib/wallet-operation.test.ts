import assert from "node:assert/strict";
import test from "node:test";
import type { ApiPromise } from "@polkadot/api";
import type { Signer } from "@polkadot/types/types";
import { encodeAddress } from "@polkadot/util-crypto";
import { guardedSignAndSend, walletOperation, type WalletOperationContext } from "./wallet-operation.ts";
const address = encodeAddress(new Uint8Array(32).fill(1), 42);
const origin: WalletOperationContext = { account: address, source: "wallet", genesisHash: "testnet", runtime: "3002", live: true, draft: "reviewed call", revision: 1 };

test("every context dimension invalidates a reviewed wallet operation, including switch away and back", () => {
  let latest = { ...origin };
  const operation = walletOperation(origin, () => latest);
  assert.equal(operation.current(), true);
  for (const change of [{ account: encodeAddress(new Uint8Array(32).fill(2), 42) }, { source: "other" }, { genesisHash: "other" }, { runtime: "3003" }, { live: false }, { draft: "changed" }, { revision: 3 }]) {
    latest = { ...origin, ...change };
    assert.equal(operation.current(), false);
  }
});

test("account changes while an extension popup is open discard its signature before broadcast", async () => {
  let latest = { ...origin }, sends = 0;
  const operation = walletOperation(origin, () => latest);
  const tx = {
    signAndSend: async () => { throw Error("unguarded path"); },
    signAsync: async () => { latest = { ...origin, revision: 2 }; return { send: async () => { sends++; return () => {}; } }; },
  };
  const result = await guardedSignAndSend(operation, [{} as ApiPromise, tx, address, {} as Signer, () => {}]);
  assert.equal(result.status, "ambiguous"); assert.equal(sends, 0);
});

test("a context change during an asynchronous quote check cannot reach broadcast", async () => {
  let latest = { ...origin }, sends = 0;
  const tx = { signAndSend: async () => () => {}, signAsync: async () => ({ send: async () => { sends++; return () => {}; } }) };
  await guardedSignAndSend(walletOperation(origin, () => latest), [{} as ApiPromise, tx, address, {} as Signer, () => {}, undefined, async () => { latest = { ...origin, source: "other" }; return true; }]);
  assert.equal(sends, 0);
});

test("disconnect ends a pending wallet request in the app and discards a later signature", { timeout: 3000 }, async () => {
  let latest = { ...origin }, sends = 0;
  let approve!: (value: { send: () => Promise<() => void> }) => void;
  const tx = { signAndSend: async () => () => {}, signAsync: () => new Promise<{ send: () => Promise<() => void> }>(resolve => { approve = resolve; }) };
  const pending = guardedSignAndSend(walletOperation(origin, () => latest), [{} as ApiPromise, tx, address, {} as Signer, () => {}]);
  latest = { ...origin, account: null, revision: 2 };
  const outcome = await pending;
  assert.equal(outcome.notBroadcast, true);
  approve({ send: async () => { sends++; return () => {}; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sends, 0);
});
