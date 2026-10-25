/**
 * Largest queryInfo shortfall versus TransactionFeePaid in the scanned sample.
 * It is not a maximum for every call, wallet, or runtime version.
 * balances.transferKeepAlive block 154574 was short by 1113 planck.
 * utility.batchAll block 154647 was short by 4383 planck.
 * Unsigned queryInfo at a block returned 0, so that path is not a fee.
 */
export const OBSERVED_FEE_SHORTFALL = 4383n;

/** Policy reserve, not an empirical upper bound: 10% of the estimate or the observed gap. */
export function feeReserve(partialFee: bigint): bigint {
  const relative = (partialFee + 9n) / 10n;
  return relative > OBSERVED_FEE_SHORTFALL ? relative : OBSERVED_FEE_SHORTFALL;
}
export function guardedFee(partialFee: bigint | null, shortfall?: bigint): bigint | null {
  shortfall ??= partialFee !== null ? feeReserve(partialFee) : OBSERVED_FEE_SHORTFALL;
  if (partialFee === null || partialFee <= BigInt(0) || shortfall < BigInt(0)) return null;
  return partialFee + shortfall;
}

export type FeeReview = { estimatedFee: string; feeBudget: string; preflightBlockHash: string; runtimeVersion: string; call?: string };
const reviews = new WeakMap<object, FeeReview>();
export function rememberFeeReview(tx: object, review: FeeReview) { reviews.set(tx, review); }
export function feeReviewFor(tx: object) { return reviews.get(tx); }

export function feePaidFor(events: Array<{ phase?: { isApplyExtrinsic?: boolean; asApplyExtrinsic?: number | { toNumber?(): number }; ApplyExtrinsic?: number }; event: { section: string; method: string; data?: Array<{ toString(): string }> } }> | undefined, index: number | undefined) {
  if (index === undefined) return {};
  for (const row of events ?? []) {
    const position = row.phase?.isApplyExtrinsic ? typeof row.phase.asApplyExtrinsic === "number" ? row.phase.asApplyExtrinsic : row.phase.asApplyExtrinsic?.toNumber?.() : row.phase?.ApplyExtrinsic;
    if (position !== index || row.event.section !== "transactionPayment" || row.event.method !== "TransactionFeePaid") continue;
    const actualFee = row.event.data?.[1]?.toString().replace(/,/g, ""), feeTip = row.event.data?.[2]?.toString().replace(/,/g, "");
    if (actualFee && /^\d+$/.test(actualFee)) return { actualFee, ...(feeTip && /^\d+$/.test(feeTip) ? { feeTip } : {}) };
  }
  return {};
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
