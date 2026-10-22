import assert from "node:assert/strict";
import test from "node:test";
import { lpTokenFromPoolValue, parsePoolKey } from "./pool-key.ts";

test("a pool storage key can be one tuple of Native and WithId", () => {
  const pair = parsePoolKey({
    args: [
      {
        toHuman: () => ["Native", { WithId: "4,242" }],
      },
    ],
  });
  assert.deepEqual(pair, [
    { kind: "native" },
    { kind: "asset", id: "4242" },
  ]);
});

test("the pool record can be an Option around the LP token", () => {
  assert.equal(
    lpTokenFromPoolValue({
      isNone: false,
      unwrap: () => ({ lpToken: { toString: () => "0" } }),
    }),
    "0",
  );
  assert.equal(lpTokenFromPoolValue({ isNone: true, unwrap: () => ({ lpToken: { toString: () => "1" } }) }), null);
});

test("a pool storage key can still be two separate args", () => {
  const pair = parsePoolKey({
    args: [{ toHuman: () => "Native" }, { toHuman: () => ({ WithId: "7" }) }],
  });
  assert.deepEqual(pair, [
    { kind: "native" },
    { kind: "asset", id: "7" },
  ]);
});
