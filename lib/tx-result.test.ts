import assert from "node:assert/strict";
import test from "node:test";
import { txResultMessage } from "./tx-result.ts";

test("only finalization is described as final", () => {
  assert.equal(txResultMessage("finalized"), "Finalized.");
  assert.match(txResultMessage("included"), /not reported/);
  assert.match(txResultMessage("submitted"), /not a final result/);
  assert.equal(txResultMessage("failed", "MethodDisabled"), "MethodDisabled");
});
