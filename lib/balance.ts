export function keptAliveSpendable(input: {
  free: string | null;
  reserved: string | null;
  frozen: bigint | null;
  existentialDeposit: string | null;
}): string | null {
  const free = plainDigits(input.free);
  const reserved = plainDigits(input.reserved);
  const existentialDeposit = plainDigits(input.existentialDeposit);
  if (free === null || reserved === null || existentialDeposit === null) return null;
  const frozen = input.frozen ?? BigInt(0);
  const reservedRaw = BigInt(reserved);
  const frozenAboveReserved = frozen > reservedRaw ? frozen - reservedRaw : BigInt(0);
  const deposit = BigInt(existentialDeposit);
  const hold = deposit > frozenAboveReserved ? deposit : frozenAboveReserved;
  const freeRaw = BigInt(free);
  return freeRaw > hold ? (freeRaw - hold).toString() : "0";
}

export function planck(value: string | null | undefined): bigint | null {
  if (value == null) return null;
  const text = value.replace(/,/g, "");
  return /^\d+$/.test(text) ? BigInt(text) : null;
}

export function largestFrozenBalance(values: Array<string | null | undefined>): bigint | null {
  let max: bigint | null = null;
  for (const value of values) {
    const next = planck(value);
    if (next === null) continue;
    if (max === null || next > max) max = next;
  }
  return max;
}

function plainDigits(value: string | null): string | null {
  if (!value) return null;
  const text = value.replace(/,/g, "");
  return /^\d+$/.test(text) ? text : null;
}
