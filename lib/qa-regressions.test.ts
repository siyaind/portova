import assert from "node:assert/strict";
import test from "node:test";
import { positiveAmountError } from "./format.ts";
import { poolCreationCosts } from "./pool-cost.ts";

test("amount validation distinguishes excessive precision from zero and malformed amounts", () => {
  assert.equal(positiveAmountError("1.123456789", 8), "Use at most 8 decimal places.");
  assert.equal(positiveAmountError("1", 8), null);
  assert.equal(positiveAmountError("0", 8), "Enter an amount above zero.");
  assert.equal(positiveAmountError("-1", 8), "Enter an amount above zero.");
  assert.equal(positiveAmountError("1e2", 8), "Enter a valid decimal amount.");
});

test("pool creation budgets include every non-native pool account and its LP account reserve", () => {
  const unit = "100000000000000";
  assert.deepEqual(poolCreationCosts(unit,unit,unit,1), {setup:BigInt(unit),reserved:2n*BigInt(unit),total:3n*BigInt(unit)});
  assert.equal(poolCreationCosts(unit,unit,unit,2)?.total, 4n*BigInt(unit));
  assert.equal(poolCreationCosts(unit,null,unit,1),null);
  assert.equal(poolCreationCosts(unit,unit,null,1),null);
});
