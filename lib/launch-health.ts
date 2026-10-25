/** Integer models only. None of these values is a market-price feed or executable quote. */
export function rawAmount(value: string | null | undefined): bigint | null {
  return value && /^\d+$/.test(value) ? BigInt(value) : null;
}
export function outsideIssuerSupply(supply: string | null, issuerBalance: string | null): string | null {
  const total = rawAmount(supply), held = rawAmount(issuerBalance);
  return total !== null && held !== null && held <= total ? (total - held).toString() : null;
}
export function shareBasisPoints(balance: string | null, supply: string | null): number | null {
  const held = rawAmount(balance), total = rawAmount(supply);
  return held !== null && total !== null && total > 0n && held <= total ? Number(held * 10_000n / total) : null;
}
export function constantProductScenario(reserveIn: string | null, reserveOut: string | null, amount: string | null) {
  const x = rawAmount(reserveIn), y = rawAmount(reserveOut), input = rawAmount(amount);
  if (x === null || y === null || input === null || x <= 0n || y <= 0n || input <= 0n) return null;
  return { output: (y * input / (x + input)).toString(), impactBps: Number((input * 10_000n + x + input - 1n) / (x + input)) };
}
export function proRataReserve(reserve: string | null, balance: string | null, issuance: string | null): string | null {
  const amount = rawAmount(reserve), held = rawAmount(balance), total = rawAmount(issuance);
  return amount !== null && held !== null && total !== null && total > 0n && held <= total ? (amount * held / total).toString() : null;
}
