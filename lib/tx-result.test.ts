import assert from "node:assert/strict";
import test from "node:test";
import { outcomeAfterWait, statusWithoutHash, txResultMessage } from "./tx-result.ts";

test("only finalization is described as final", () => {
  assert.equal(txResultMessage("finalized"), "Finalized.");
  assert.match(txResultMessage("included"), /not confirmed/);
  assert.match(txResultMessage("submitted"), /not a final result/);
  assert.equal(txResultMessage("failed", "MethodDisabled"), "MethodDisabled");
  assert.match(txResultMessage("ambiguous"), /not proof the transaction failed/);
});

test("a missing hash is ambiguous rather than a failure", () => {
  const outcome = outcomeAfterWait({ sawIncluded: false, chain: "unchecked" });
  assert.equal(outcome.status, "ambiguous");
  assert.equal(outcome.hash, undefined);
  assert.match(outcome.error ?? "", /not proof the transaction failed/);
  assert.equal(statusWithoutHash("signing"), "ambiguous");
  assert.equal(statusWithoutHash("submitted"), "ambiguous");
  assert.equal(statusWithoutHash("failed"), "failed");
});

test("a timed-out hash is reconciled from the chain result", () => {
  assert.equal(outcomeAfterWait({ hash: "0x11", sawIncluded: false, chain: "finalized" }).status, "finalized");
  assert.equal(outcomeAfterWait({ hash: "0x11", sawIncluded: true, chain: "pending" }).status, "submitted");
  assert.equal(outcomeAfterWait({ hash: "0x11", sawIncluded: true, chain: "not-found" }).status, "ambiguous");
  assert.equal(outcomeAfterWait({ hash: "0x11", sawIncluded: true, chain: "unchecked" }).status, "included");
});
