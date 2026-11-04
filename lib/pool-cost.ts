export function poolCreationCosts(setup: string, assetDeposit: string | null, lpDeposit: string | null, nonNativeAssets: number) {
  if (![setup, assetDeposit, lpDeposit].every(value => typeof value === "string" && /^\d+$/.test(value)) || ![0, 1, 2].includes(nonNativeAssets)) return null;
  const reserved = BigInt(assetDeposit!) * BigInt(nonNativeAssets) + BigInt(lpDeposit!);
  return { setup: BigInt(setup), reserved, total: BigInt(setup) + reserved };
}
