export function balanceDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/,/g, "").trim();
  if (/^\d+$/.test(text)) return text;
  if (/^0x[0-9a-fA-F]{1,32}$/.test(text)) return BigInt(text).toString();
  return null;
}

export function reservePaysSwap(reserve: string | null, minimum: bigint): boolean | null {
  const raw = balanceDigits(reserve);
  if (raw === null || minimum < BigInt(0)) return null;
  return BigInt(raw) > minimum;
}
