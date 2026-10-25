import assert from "node:assert/strict";
import test from "node:test";
import { constantProductScenario, outsideIssuerSupply, proRataReserve, shareBasisPoints } from "./launch-health.ts";
test("outside-issuer supply is explicitly a balance subtraction, not a circulating-supply assumption", () => {
  assert.equal(outsideIssuerSupply("1000", "400"), "600");
  assert.equal(outsideIssuerSupply("1000", null), null);
  assert.equal(outsideIssuerSupply("1000", "1001"), null);
});
test("LP ownership and pro-rata reserves use exact raw-unit ratios", () => {
  assert.equal(shareBasisPoints("1", "4"), 2500);
  assert.equal(proRataReserve("100", "1", "4"), "25");
  assert.equal(shareBasisPoints("1", "0"), null);
  assert.equal(proRataReserve(null, "1", "4"), null);
});
test("larger swaps create greater model impact; missing reserves do not become zero impact", () => {
  const small = constantProductScenario("1000", "2000", "10")!;
  const large = constantProductScenario("1000", "2000", "500")!;
  assert.equal(small.output, "19"); assert.ok(large.impactBps > small.impactBps);
  assert.equal(constantProductScenario("0", "2000", "10"), null);
  assert.equal(constantProductScenario(null, "2000", "10"), null);
});
