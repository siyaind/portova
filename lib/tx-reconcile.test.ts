import assert from "node:assert/strict";
import test from "node:test";
import type { ApiPromise } from "@polkadot/api";
import { dispatchOutcome, reconcileExtrinsic } from "./tx-reconcile.ts";

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
