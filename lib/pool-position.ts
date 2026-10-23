export type PoolPosition = {
  blockHash: string;
  reserve1: string | null;
  reserve2: string | null;
  lpSupply: string | null;
};

export function sameFacts(left: Array<string | null>, right: Array<string | null>): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function readPositionAtFinalizedBlock(input: {
  finalizedHash: () => Promise<string>;
  readAt: (blockHash: string) => Promise<Omit<PoolPosition, "blockHash">>;
}): Promise<PoolPosition> {
  const blockHash = await input.finalizedHash();
  const value = await input.readAt(blockHash);
  return { blockHash, ...value };
}
