import assert from "node:assert/strict";
import test from "node:test";
import { OBSERVED_FEE_SHORTFALL, feeHeadroom, feePaidFor, feeReserve, guardedFee } from "./fee-evidence.ts";

test("the signed fee margin covers the shortfall measured on included testnet calls", () => {
  const charged = [
    { estimate: 1500554198766n, actual: 1500554199879n },
    { estimate: 1551871525943n, actual: 1551871530326n },
  ];
  for (const row of charged) {
    assert.ok(row.actual - row.estimate <= OBSERVED_FEE_SHORTFALL);
    assert.ok(guardedFee(row.estimate)! >= row.actual);
  }
  assert.equal(guardedFee(0n), null);
  assert.equal(guardedFee(null), null);
  assert.equal(feeHeadroom(100n, 90n, 20n), "marginal");
  assert.equal(feeHeadroom(100n, 70n, 20n), "ok");
  assert.equal(feeHeadroom(100n, 101n, 20n), "short");
});

test("fee reserve scales with the estimate without treating the two-call sample as a universal bound", () => {
  assert.equal(feeReserve(1000n), OBSERVED_FEE_SHORTFALL);
  assert.equal(feeReserve(1_000_000n), 100_000n);
  assert.equal(guardedFee(1_000_000n), 1_100_000n);
  assert.equal(feeHeadroom(1_150_000n, 1_100_000n, feeReserve(1_000_000n)), "marginal");
});
test("charged fee measurements require the matching extrinsic index", () => {
  const event = { phase: { isApplyExtrinsic: true, asApplyExtrinsic: 2 }, event: { section: "transactionPayment", method: "TransactionFeePaid", data: ["account", "123", "0"].map(value => ({ toString: () => value })) } };
  assert.deepEqual(feePaidFor([event], 1), {});
  assert.deepEqual(feePaidFor([event], 2), { actualFee: "123", feeTip: "0" });
});
