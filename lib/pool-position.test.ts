import assert from "node:assert/strict";
import test from "node:test";
import { readPositionAtFinalizedBlock, sameFacts } from "./pool-position.ts";

test("pool reserves and supply can change between separate reads", async () => {
  const blocks: Record<string, { reserve1: string; reserve2: string; lpSupply: string }> = {
    "0xaaa": { reserve1: "1000", reserve2: "2000", lpSupply: "100" },
    "0xbbb": { reserve1: "5", reserve2: "9", lpSupply: "1" },
  };
  let head = "0xaaa";
  const unpinnedReserves = async () => {
    const row = blocks[head];
    head = "0xbbb";
    return [row.reserve1, row.reserve2] as const;
  };
  const unpinnedSupply = async () => blocks[head].lpSupply;
  const [reserve1] = await unpinnedReserves();
  const lpSupply = await unpinnedSupply();
  assert.equal(reserve1, "1000");
  assert.equal(lpSupply, "1");
  assert.equal(sameFacts([reserve1, "2000", lpSupply], ["1000", "2000", "100"]), false);
});

test("reserves and LP supply are read from the pinned finalized block", async () => {
  const blocks: Record<string, { reserve1: string; reserve2: string; lpSupply: string }> = {
    "0xaaa": { reserve1: "1000", reserve2: "2000", lpSupply: "100" },
    "0xbbb": { reserve1: "5", reserve2: "9", lpSupply: "1" },
  };
  let head = "0xaaa";
  const position = await readPositionAtFinalizedBlock({
    finalizedHash: async () => head,
    readAt: async (blockHash) => {
      head = "0xbbb";
      const row = blocks[blockHash];
      return { reserve1: row.reserve1, reserve2: row.reserve2, lpSupply: row.lpSupply };
    },
  });
  assert.equal(position.blockHash, "0xaaa");
  assert.deepEqual(
    [position.reserve1, position.reserve2, position.lpSupply],
    ["1000", "2000", "100"],
  );
  assert.equal(sameFacts([position.reserve1, position.reserve2, position.lpSupply], ["5", "9", "1"]), false);
});
