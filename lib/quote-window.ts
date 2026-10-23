import { optimalDeposit } from "./liquidity-math.ts";

export const QUOTE_EXPIRY_MS = 30_000;

export const WALLET_MOVE_WARNING =
  "The pool or listing can change while the wallet is open. After you approve, Portova checks again and does not submit the signature if your minimum would fail. A transaction that is submitted and then fails still pays the fee.";

export function quoteExpired(quotedAt: number, now: number, ttl = QUOTE_EXPIRY_MS): boolean {
  if (!Number.isFinite(quotedAt) || !Number.isFinite(now)) return true;
  return now - quotedAt >= ttl;
}

export function swapStillExecutable(latestOut: bigint, signedMinimum: bigint): boolean {
  return latestOut > BigInt(0) && signedMinimum > BigInt(0) && latestOut >= signedMinimum;
}

export function depositStillExecutable(
  desired1: bigint,
  desired2: bigint,
  min1: bigint,
  min2: bigint,
  reserve1: bigint | null,
  reserve2: bigint | null,
): boolean {
  const quote = optimalDeposit(desired1, desired2, reserve1, reserve2);
  return quote !== null && quote.amount1 >= min1 && quote.amount2 >= min2;
}

export function withdrawalStillExecutable(
  reserve1: bigint,
  reserve2: bigint,
  supply: bigint,
  burn: bigint,
  signedMin1: bigint,
  signedMin2: bigint,
): boolean {
  if (supply <= BigInt(0) || burn <= BigInt(0)) return false;
  const out1 = (reserve1 * burn) / supply;
  const out2 = (reserve2 * burn) / supply;
  return out1 >= signedMin1 && out2 >= signedMin2;
}
