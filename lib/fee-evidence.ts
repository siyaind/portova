/**
 * queryInfo on the signed bytes was short of TransactionFeePaid by 1113 planck
 * for balances.transferKeepAlive in block 154574 and by 4383 planck for
 * utility.batchAll in block 154647 on wss://test-node-v3.portaldot.dev.
 * Unsigned queryInfo at the same block returned 0 for transfer, mint, NFT mint,
 * add-liquidity, and swap, so that path is not a fee.
 */
export const SIGNED_FEE_SHORTFALL = 4383n;

export function guardedFee(partialFee: bigint | null, shortfall = SIGNED_FEE_SHORTFALL): bigint | null {
  if (partialFee === null || partialFee <= BigInt(0) || shortfall < BigInt(0)) return null;
  return partialFee + shortfall;
}
