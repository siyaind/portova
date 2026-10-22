export type DepositQuote = {
  amount1: bigint;
  amount2: bigint;
  reservesUsed: boolean;
};

export function pairedAmount(amount: bigint, reserveIn: bigint, reserveOut: bigint): bigint | null {
  if (amount <= BigInt(0) || reserveIn <= BigInt(0) || reserveOut <= BigInt(0)) return null;
  const other = (amount * reserveOut) / reserveIn;
  return other > BigInt(0) ? other : null;
}

export function optimalDeposit(
  desired1: bigint,
  desired2: bigint,
  reserve1: bigint | null,
  reserve2: bigint | null,
): DepositQuote | null {
  if (desired1 <= BigInt(0) || desired2 <= BigInt(0)) return null;
  if (reserve1 === null || reserve2 === null || reserve1 <= BigInt(0) || reserve2 <= BigInt(0)) {
    return { amount1: desired1, amount2: desired2, reservesUsed: false };
  }
  const amount2Optimal = (desired1 * reserve2) / reserve1;
  if (amount2Optimal > BigInt(0) && amount2Optimal <= desired2) {
    return { amount1: desired1, amount2: amount2Optimal, reservesUsed: true };
  }
  const amount1Optimal = (desired2 * reserve1) / reserve2;
  if (amount1Optimal > BigInt(0) && amount1Optimal <= desired1) {
    return { amount1: amount1Optimal, amount2: desired2, reservesUsed: true };
  }
  return null;
}

export function swapQuoteKey(lpToken: string, flipped: boolean, amountIn: string, block: string | null): string {
  return `${lpToken}|${flipped ? "1" : "0"}|${amountIn}|${block ?? "no-block"}`;
}
