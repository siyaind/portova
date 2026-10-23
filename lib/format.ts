export function formatUnits(
  value: string,
  decimals: number,
  fractionDigits = 4,
): string {
  const negative = value.startsWith("-");
  const digits = negative ? value.slice(1) : value;
  if (!/^\d+$/.test(digits) || decimals < 0) return "Unavailable";

  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals) || "0";
  const decimalPart = padded.slice(padded.length - decimals);
  let fraction = decimalPart.slice(0, fractionDigits).replace(/0+$/, "");
  if (!fraction && whole === "0" && /[1-9]/.test(digits)) {
    const first = decimalPart.search(/[1-9]/);
    if (first >= 0) {
      fraction = decimalPart.slice(0, Math.min(decimalPart.length, first + 4)).replace(/0+$/, "");
    }
  }
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const shown = fraction ? `${grouped}.${fraction}` : grouped;
  return negative ? `-${shown}` : shown;
}

export function shortAddress(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

const U128_MAX = (BigInt(1) << BigInt(128)) - BigInt(1);

export function parseDecimalToPlanck(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed) || decimals < 0 || decimals > 38) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) return null;
  const digits = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+/, "") || "0";
  const amount = BigInt(digits);
  if (amount > U128_MAX) return null;
  return amount;
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The request failed.";
}
