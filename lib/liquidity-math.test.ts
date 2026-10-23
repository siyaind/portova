import assert from "node:assert/strict";
import test from "node:test";
import { assetRemainder, callNativeCost, optimalDeposit, pairedAmount, removalMinimum, swapQuoteKey } from "./liquidity-math.ts";

test("an unbalanced deposit is reduced to the reserve ratio before slippage", () => {
  const quote = optimalDeposit(100n, 100n, 1000n, 2000n);
  assert.deepEqual(quote, { amount1: 50n, amount2: 100n, reservesUsed: true });
  assert.ok(quote);
  assert.equal((quote.amount1 * 9950n) / 10000n, 49n);
});

test("a matching ratio keeps both desired amounts", () => {
  const quote = optimalDeposit(100n, 200n, 1000n, 2000n);
  assert.deepEqual(quote, { amount1: 100n, amount2: 200n, reservesUsed: true });
});

test("missing reserves do not invent a ratio", () => {
  const quote = optimalDeposit(5n, 9n, null, null);
  assert.deepEqual(quote, { amount1: 5n, amount2: 9n, reservesUsed: false });
});

test("a zero optimal amount is refused", () => {
  assert.equal(optimalDeposit(1n, 1n, 10_000n, 1n), null);
});

test("one deposit side fills the other from the reserve ratio", () => {
  assert.equal(pairedAmount(100000000000000n, 100000000000000n, 1000000000000000000000n), 1000000000000000000000n);
  assert.equal(pairedAmount(1n, 10n, 1n), null);
});

test("a withdrawal minimum uses the supply from the same snapshot as the reserves", () => {
  const thin = removalMinimum("1000", "100", 10n, "0.5");
  const diluted = removalMinimum("1000", "200", 10n, "0.5");
  assert.equal(thin, 99n);
  assert.equal(diluted, 49n);
  assert.ok(thin !== null && diluted !== null && thin > diluted);
  assert.equal(removalMinimum("1000", null, 10n, "0.5"), null);
});

test("a deposit cost is refused when the fee or a required deposit is unknown", () => {
  assert.equal(callNativeCost([100n, 5n, 0n]), 105n);
  assert.equal(callNativeCost([100n, null, 0n]), null);
  assert.equal(assetRemainder(100n, 90n, 20n), "dust");
  assert.equal(assetRemainder(100n, 80n, 20n), "ok");
  assert.equal(assetRemainder(100n, 101n, 1n), "short");
  assert.equal(assetRemainder(100n, 100n, 20n), "ok");
});

test("a quote key changes with the pool, direction, amount, and block", () => {
  const first = swapQuoteKey("7", false, "1000", "10");
  assert.notEqual(first, swapQuoteKey("7", true, "1000", "10"));
  assert.notEqual(first, swapQuoteKey("7", false, "1001", "10"));
  assert.notEqual(first, swapQuoteKey("7", false, "1000", "11"));
});
