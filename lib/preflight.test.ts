import assert from "node:assert/strict";
import test from "node:test";
import { reviewCall } from "./preflight.ts";

const HASH = `0x${"ab".repeat(32)}`;

function txOf(fee: string) {
  const tx = {
    id: "same-call",
    paymentInfo: async (payer: string) => {
      assert.equal(payer, "alice");
      return { partialFee: { toString: () => fee } };
    },
  };
  return tx;
}

test("preflight keeps the reviewed call and refuses an unaffordable one", async () => {
  const tx = txOf("5");
  const affordable = await reviewCall({
    tx,
    payer: "alice",
    nativeDebits: [10n],
    finalizedHash: async () => HASH,
    accountAt: async () => ({ free: "100", reserved: "0", frozen: 0n, existentialDeposit: "10" }),
    decimals: 0,
    symbol: "UNIT",
    feeShortfall: 0n,
  });
  assert.equal(affordable.ok, true);
  if (!affordable.ok) return;
  assert.equal(affordable.tx, tx);
  assert.equal(affordable.fee, 5n);
  assert.equal(affordable.spendable, 90n);
  assert.equal(affordable.nativeNeed, 15n);

  const short = await reviewCall({
    tx,
    payer: "alice",
    nativeDebits: [10n],
    finalizedHash: async () => HASH,
    accountAt: async () => ({ free: "20", reserved: "0", frozen: 0n, existentialDeposit: "10" }),
    decimals: 0,
    symbol: "UNIT",
    feeShortfall: 0n,
  });
  assert.equal(short.ok, false);
  if (short.ok) return;
  assert.match(short.message, /not proof the call will succeed/);
  assert.match(short.message, /wallet was not opened/);
});

test("the swap funding precheck refuses the reported giant tPOT input and includes the fee reserve", async () => {
  const unit = 10n**14n;
  const run = (amount:bigint) => reviewCall({tx:txOf("1800000000000"),payer:"alice",nativeDebits:[amount],finalizedHash:async()=>HASH,
    accountAt:async()=>({free:(353n*unit).toString(),reserved:"0",frozen:0n,existentialDeposit:unit.toString()})});
  const huge = await run(99999999n*unit);
  assert.equal(huge.ok,false);
  if (!huge.ok) assert.match(huge.message,/wallet was not opened/);
  assert.equal((await run(352n*unit)).ok,false); // Exact spendable is insufficient once fees are included.
  assert.equal((await run(unit/10n)).ok,true);
});

test("an unknown deposit or a V3 account that cannot pay is not treated as success", async () => {
  const missing = await reviewCall({
    tx: txOf("5"),
    payer: "alice",
    nativeDebits: [null],
    finalizedHash: async () => HASH,
    accountAt: async () => ({ free: "100", reserved: "0", frozen: 0n, existentialDeposit: "10" }),
    feeShortfall: 0n,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.message, /not proof the call will succeed/);

  const observed = await reviewCall({
    tx: txOf("10000000000000"),
    payer: "alice",
    nativeDebits: [0n],
    finalizedHash: async () => HASH,
    accountAt: async () => ({ free: "0", reserved: "0", frozen: 0n, existentialDeposit: "10000000000000" }),
    feeShortfall: 0n,
  });
  assert.equal(observed.ok, false);
});
