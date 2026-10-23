import assert from "node:assert/strict";
import test from "node:test";
import {
  QUOTE_EXPIRY_MS,
  depositStillExecutable,
  quoteExpired,
  swapStillExecutable,
  withdrawalStillExecutable,
} from "./quote-window.ts";

test("a quote expires after 30 seconds and a moved pool is not submitted below its minimum", () => {
  assert.equal(quoteExpired(1_000, 1_000 + QUOTE_EXPIRY_MS - 1), false);
  assert.equal(quoteExpired(1_000, 1_000 + QUOTE_EXPIRY_MS), true);
  assert.equal(swapStillExecutable(100n, 99n), true);
  assert.equal(swapStillExecutable(98n, 99n), false);
  assert.equal(depositStillExecutable(100n, 200n, 99n, 198n, 1000n, 2000n), true);
  assert.equal(depositStillExecutable(100n, 200n, 100n, 200n, 1000n, 1000n), false);
  assert.equal(withdrawalStillExecutable(1000n, 2000n, 100n, 10n, 90n, 180n), true);
  assert.equal(withdrawalStillExecutable(1000n, 2000n, 100n, 10n, 110n, 180n), false);
});
