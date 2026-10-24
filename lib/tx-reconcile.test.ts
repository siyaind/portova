import assert from "node:assert/strict";
import test from "node:test";
import type { ApiPromise } from "@polkadot/api";
import { collectionIdForHash, dispatchOutcome, reconcileExtrinsic, reconcileReceipt } from "./tx-reconcile.ts";

const HASH = `0x${"ab".repeat(32)}`;

function codec(value: string, empty = false) {
  return { toHex: () => value, isEmpty: empty };
}

function block(number: number, parent: string, hashes: string[], blockHash = "0xblock") {
  return {
    block: {
      header: {
        hash: codec(blockHash),
        parentHash: codec(parent, parent === "0x"),
        number: { toNumber: () => number },
      },
      extrinsics: hashes.map((value) => ({ hash: codec(value) })),
    },
  };
}

function successEvent(index: number) {
  return {
    phase: { isApplyExtrinsic: true, asApplyExtrinsic: { toNumber: () => index } },
    event: { section: "system", method: "ExtrinsicSuccess" },
  };
}

function failedEvent(index: number) {
  return {
    phase: { isApplyExtrinsic: true, asApplyExtrinsic: { toNumber: () => index } },
    event: { section: "system", method: "ExtrinsicFailed" },
  };
}

function apiFor(head: ReturnType<typeof block>, events: ReturnType<typeof successEvent>[] = []) {
  return {
    rpc: {
      author: { pendingExtrinsics: async () => [] },
      chain: {
        getFinalizedHead: async () => codec("0xfin"),
        getHeader: async () => ({ number: { toNumber: () => head.block.header.number.toNumber() } }),
        getBlock: async () => head,
      },
    },
    query: {
      system: {
        events: { at: async () => events },
      },
    },
  } as unknown as ApiPromise;
}

test("a finalized create recovers the nfts.Created id for that extrinsic", async () => {
  const created = {
    phase: { isApplyExtrinsic: true, asApplyExtrinsic: { toNumber: () => 0 } },
    event: { section: "nfts", method: "Created", data: [{ toString: () => "9" }] },
  };
  const other = {
    phase: { isApplyExtrinsic: true, asApplyExtrinsic: { toNumber: () => 1 } },
    event: { section: "nfts", method: "Created", data: [{ toString: () => "4" }] },
  };
  const api = apiFor(block(10, "0xparent", [HASH]), [successEvent(0), created, other]);
  assert.equal(await collectionIdForHash(api, HASH), "9");
});

test("ExtrinsicSuccess in a finalized block is finalized", async () => {
  const found = await reconcileExtrinsic(apiFor(block(10, "0xparent", [HASH]), [successEvent(0)]), HASH);
  assert.equal(found, "finalized");
});

test("ExtrinsicFailed in a finalized block is failed", async () => {
  const found = await reconcileExtrinsic(apiFor(block(10, "0xparent", [HASH]), [failedEvent(0)]), HASH);
  assert.equal(found, "failed");
});

test("a block hash without a dispatch event is not marked successful", async () => {
  const found = await reconcileExtrinsic(apiFor(block(10, "0xparent", [HASH]), []), HASH);
  assert.equal(found, "dispatch-unknown");
});

test("dispatch events are matched by extrinsic index", () => {
  assert.equal(dispatchOutcome([failedEvent(1), successEvent(0)], 0), "success");
  assert.equal(dispatchOutcome([successEvent(0), failedEvent(1)], 1), "failed");
  assert.equal(dispatchOutcome([successEvent(0)], 1), "unknown");
  assert.equal(dispatchOutcome([successEvent(0), failedEvent(0)], 0), "failed");
});

test("a hash still in the pool stays pending", async () => {
  const found = await reconcileExtrinsic({
    rpc: {
      author: { pendingExtrinsics: async () => [{ hash: codec(HASH) }] },
      chain: {
        getFinalizedHead: async () => codec("0xfin"),
        getHeader: async () => ({ number: { toNumber: () => 1 } }),
        getBlock: async () => block(1, "0x", []),
      },
    },
  } as unknown as ApiPromise, HASH);
  assert.equal(found, "pending");
});

test("a hash outside the pool and recent blocks is not found", async () => {
  const found = await reconcileExtrinsic(
    {
      rpc: {
        author: { pendingExtrinsics: async () => [] },
        chain: {
          getFinalizedHead: async () => codec("0xfin"),
          getHeader: async () => ({ number: { toNumber: () => 4 } }),
          getBlock: async () => block(4, "0x", []),
        },
      },
    } as unknown as ApiPromise,
    HASH,
    2,
  );
  assert.equal(found, "not-found");
});

function historyApi(target: number, pruned = false) {
  return {
    rpc: { author: { pendingExtrinsics: async () => { throw Error("disabled"); } }, chain: {
      getFinalizedHead: async () => codec("1000"),
      getHeader: async () => ({ number: { toNumber: () => 1000 } }),
      getBlockHash: async (height: number) => codec(String(height)),
      getBlock: async (value?: { toHex(): string } | string) => {
        const height = value === undefined ? 1000 : Number(typeof value === "string" ? value : value.toHex());
        return block(height, String(height - 1), height === target ? [HASH] : [], String(height));
      },
    } },
    query: { system: { events: { at: async () => { if (pruned) throw Error("pruned"); return [successEvent(0)]; } } } },
  } as unknown as ApiPromise;
}

test("persisted inclusion height recovers an old receipt despite disabled author RPC", async () => {
  const found = await reconcileReceipt(historyApi(10), HASH, { blockNumber: 10 });
  assert.equal(found.chain, "finalized");
  assert.equal(found.blockNumber, 10);
  assert.equal(found.extrinsicIndex, 0);
});

test("older block recovery advances across bounded pages and honors its lower boundary", async () => {
  const api = historyApi(950);
  const first = await reconcileReceipt(api, HASH, { fromBlock: 940, maxBlocks: 24 });
  assert.equal(first.chain, "not-found");
  assert.equal(first.nextCursor, 976);
  const second = await reconcileReceipt(api, HASH, { fromBlock: 940, cursor: first.nextCursor, maxBlocks: 32 });
  assert.equal(second.chain, "finalized");
  assert.equal(second.blockNumber, 950);
  assert.equal((await reconcileReceipt(api, HASH, { fromBlock: 980, maxBlocks: 64 })).nextCursor, undefined);
});

test("pruned events and a noncanonical hinted block never establish success", async () => {
  assert.equal((await reconcileReceipt(historyApi(10, true), HASH, { blockNumber: 10 })).chain, "dispatch-unknown");
  const api = historyApi(10);
  api.rpc.chain.getBlockHash = (async () => codec("other")) as never;
  assert.equal((await reconcileReceipt(api, HASH, { blockHash: "10", maxBlocks: 1 })).chain, "not-found");
});
