import assert from "node:assert/strict";
import test from "node:test";
import { OBSERVED_FEE_SHORTFALL, feeHeadroom, guardedFee } from "./fee-evidence.ts";

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
