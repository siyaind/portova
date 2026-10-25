import assert from "node:assert/strict";
import test from "node:test";
import { mapBounded } from "./async-map.ts";
test("RPC concurrency stays bounded while preserving item order", async () => {
  let active = 0, maximum = 0;
  const result = await mapBounded(Array.from({ length: 100 }, (_, i) => i), 4, async value => {
    active++; maximum = Math.max(maximum, active); await Promise.resolve(); active--; return value * 2;
  });
  assert.equal(maximum, 4); assert.deepEqual(result, Array.from({ length: 100 }, (_, i) => i * 2));
});
