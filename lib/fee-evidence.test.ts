import assert from "node:assert/strict";
import test from "node:test";
import { SIGNED_FEE_SHORTFALL, guardedFee } from "./fee-evidence.ts";

test("the signed fee margin covers the shortfall measured on included testnet calls", () => {
  const charged = [
    { estimate: 1500554198766n, actual: 1500554199879n },
    { estimate: 1551871525943n, actual: 1551871530326n },
  ];
  for (const row of charged) {
    assert.ok(row.actual - row.estimate <= SIGNED_FEE_SHORTFALL);
    assert.ok(guardedFee(row.estimate)! >= row.actual);
  }
  assert.equal(guardedFee(0n), null);
  assert.equal(guardedFee(null), null);
});
