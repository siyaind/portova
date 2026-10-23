import assert from "node:assert/strict";
import test from "node:test";
import { extrinsicDispatch, outcomeAfterWait, outcomeWithoutHash, statusWithoutHash, txResultMessage } from "./tx-result.ts";

test("only finalization is described as final", () => {
  assert.equal(txResultMessage("finalized"), "Finalized.");
  assert.match(txResultMessage("included"), /not confirmed/);
  assert.match(txResultMessage("submitted"), /not a final result/);
  assert.equal(txResultMessage("failed", "MethodDisabled"), "MethodDisabled");
  assert.match(txResultMessage("ambiguous"), /not proof the transaction failed/);
});

test("finalized success requires system.ExtrinsicSuccess", () => {
  assert.equal(extrinsicDispatch([{ event: { section: "system", method: "ExtrinsicSuccess" } }]), "success");
  assert.equal(extrinsicDispatch([{ event: { section: "system", method: "ExtrinsicFailed" } }]), "failed");
  assert.equal(extrinsicDispatch([{ event: { section: "assets", method: "Created" } }]), "unknown");
  assert.equal(extrinsicDispatch(undefined), "unknown");
});

test("a wallet cancel or a rejected fee with no hash stays unknown", () => {
  const cancelled = outcomeWithoutHash("Cancelled");
  assert.equal(cancelled.status, "ambiguous");
  assert.match(cancelled.error, /Cancelled/);
  assert.match(cancelled.error, /not recorded as a failed transaction/);
  const unpaid = outcomeWithoutHash("1010: Invalid Transaction: Inability to pay some fees");
  assert.equal(unpaid.status, "ambiguous");
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
  assert.equal(outcomeAfterWait({ hash: "0x11", sawIncluded: true, chain: "failed" }).status, "failed");
  assert.equal(outcomeAfterWait({ hash: "0x11", sawIncluded: true, chain: "dispatch-unknown" }).status, "ambiguous");
  assert.equal(outcomeAfterWait({ hash: "0x11", sawIncluded: true, chain: "not-found" }).status, "ambiguous");
  assert.equal(outcomeAfterWait({ hash: "0x11", sawIncluded: true, chain: "unchecked" }).status, "included");
});
