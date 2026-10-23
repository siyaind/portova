import assert from "node:assert/strict";
import test from "node:test";
import { keptAliveSpendable } from "./balance.ts";

test("spendable balance keeps the existential deposit and frozen funds", () => {
  assert.equal(keptAliveSpendable({ free: "100", reserved: "0", frozen: 0n, existentialDeposit: "10" }), "90");
  assert.equal(keptAliveSpendable({ free: "100", reserved: "0", frozen: 40n, existentialDeposit: "10" }), "60");
  assert.equal(keptAliveSpendable({ free: "100", reserved: "30", frozen: 40n, existentialDeposit: "10" }), "90");
  assert.equal(keptAliveSpendable({ free: "10", reserved: "0", frozen: 0n, existentialDeposit: "10" }), "0");
  assert.equal(keptAliveSpendable({ free: "100", reserved: null, frozen: 0n, existentialDeposit: "10" }), null);
  assert.equal(keptAliveSpendable({ free: "100", reserved: "0", frozen: 0n, existentialDeposit: null }), null);
  assert.equal(
    keptAliveSpendable({
      free: "21661459601971",
      reserved: "1102638827881085",
      frozen: 0n,
      existentialDeposit: "10000000000000",
    }),
    "11661459601971",
  );
});
