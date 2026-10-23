import assert from "node:assert/strict";
import test from "node:test";
import { formatUnits } from "./format.ts";

test("a non-zero amount below four decimal places stays visible", () => {
  assert.equal(formatUnits("1000", 14), "0.00000000001");
  assert.equal(formatUnits("150000000000000", 14), "1.5");
  assert.equal(formatUnits("0", 14), "0");
});
