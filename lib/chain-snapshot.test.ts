import assert from "node:assert/strict";
import test from "node:test";
import { applyChainSnapshot } from "./chain-snapshot.ts";

test("an older chain snapshot cannot replace a newer reload", () => {
  let written = "";
  const current = 2;
  assert.equal(applyChainSnapshot(1, current, false, "old", (value) => {
    written = value;
  }), false);
  assert.equal(written, "");
  assert.equal(applyChainSnapshot(2, current, false, "new", (value) => {
    written = value;
  }), true);
  assert.equal(written, "new");
  assert.equal(applyChainSnapshot(2, current, true, "cancelled", (value) => {
    written = value;
  }), false);
  assert.equal(written, "new");
});
