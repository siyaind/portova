import assert from "node:assert/strict";
import test from "node:test";
import { balanceDigits, reservePaysSwap } from "./reserve-quote.ts";

test("a pool reserve at the asset minimum cannot pay a swap", () => {
  assert.equal(balanceDigits("0x0de0b6b3a7640000"), "1000000000000000000");
  assert.equal(balanceDigits("1,000"), "1000");
  assert.equal(balanceDigits("nope"), null);
  assert.equal(reservePaysSwap("1000000000000000000", BigInt("1000000000000000000")), false);
  assert.equal(reservePaysSwap("1000000000000000001", BigInt("1000000000000000000")), true);
  assert.equal(reservePaysSwap(null, BigInt(1)), null);
});
