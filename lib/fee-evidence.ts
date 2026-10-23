/**
 * Largest queryInfo shortfall versus TransactionFeePaid in the scanned sample.
 * It is not a maximum for every call, wallet, or runtime version.
 * balances.transferKeepAlive block 154574 was short by 1113 planck.
 * utility.batchAll block 154647 was short by 4383 planck.
 * Unsigned queryInfo at a block returned 0, so that path is not a fee.
 */
export const OBSERVED_FEE_SHORTFALL = 4383n;

export function guardedFee(partialFee: bigint | null, shortfall = OBSERVED_FEE_SHORTFALL): bigint | null {
  if (partialFee === null || partialFee <= BigInt(0) || shortfall < BigInt(0)) return null;
  return partialFee + shortfall;
}

export function feeHeadroom(
  spendable: bigint,
  need: bigint,
  observedShortfall = OBSERVED_FEE_SHORTFALL,
): "short" | "marginal" | "ok" {
  if (need > spendable) return "short";
  if (spendable - need < observedShortfall) return "marginal";
  return "ok";
}
