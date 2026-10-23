import assert from "node:assert/strict";
import test from "node:test";
import { saleResultIsCurrent } from "./sale-request.ts";

test("a marketplace preview from an older id pair is discarded", () => {
  assert.equal(saleResultIsCurrent(1, 1, "1:0", "1:0"), true);
  assert.equal(saleResultIsCurrent(1, 2, "1:0", "1:1"), false);
  assert.equal(saleResultIsCurrent(2, 2, "1:0", "1:1"), false);
});
