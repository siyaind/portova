export const TESTNET_EXPLORER = "https://scanner-testnet-v3.portaldot.dev";
export function receiptExplorerUrl(hash: string): string | null {
  return /^0x[0-9a-fA-F]{64}$/.test(hash) ? `${TESTNET_EXPLORER}/#/extrinsics/${hash.toLowerCase()}` : null;
}
export function blockExplorerUrl(height: number): string | null {
  return Number.isSafeInteger(height) && height >= 0 ? `${TESTNET_EXPLORER}/#/blocks/${height}` : null;
}
