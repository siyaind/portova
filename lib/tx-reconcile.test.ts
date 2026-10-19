import assert from "node:assert/strict";
import test from "node:test";
import type { ApiPromise } from "@polkadot/api";
import { reconcileExtrinsic } from "./tx-reconcile.ts";

const HASH = `0x${"ab".repeat(32)}`;

function codec(value: string, empty = false) {
  return { toHex: () => value, isEmpty: empty };
}

function block(number: number, parent: string, hashes: string[]) {
  return {
    block: {
      header: {
        parentHash: codec(parent, parent === "0x"),
        number: { toNumber: () => number },
      },
      extrinsics: hashes.map((value) => ({ hash: codec(value) })),
    },
  };
}

test("a hash in a finalized block is reconciled as finalized", async () => {
  const head = block(10, "0xparent", [HASH]);
  const found = await reconcileExtrinsic({
    rpc: {
      author: { pendingExtrinsics: async () => [] },
      chain: {
        getFinalizedHead: async () => codec("0xfin"),
        getHeader: async () => ({ number: { toNumber: () => 10 } }),
        getBlock: async () => head,
      },
    },
  } as unknown as ApiPromise, HASH);
  assert.equal(found, "finalized");
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
