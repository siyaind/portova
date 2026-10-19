import type { ApiPromise } from "@polkadot/api";
import type { ChainMatch } from "@/lib/tx-result";

export async function reconcileExtrinsic(
  api: ApiPromise,
  hash: string,
  lookback = 24,
): Promise<ChainMatch> {
  const pending = await api.rpc.author.pendingExtrinsics();
  if (pending.some((extrinsic) => extrinsic.hash.toHex() === hash)) return "pending";

  const finalizedHeader = await api.rpc.chain.getHeader(await api.rpc.chain.getFinalizedHead());
  const finalizedNumber = finalizedHeader.number.toNumber();
  let block = await api.rpc.chain.getBlock();
  for (let i = 0; i < lookback; i += 1) {
    const found = block.block.extrinsics.some((extrinsic) => extrinsic.hash.toHex() === hash);
    const number = block.block.header.number.toNumber();
    if (found) return number <= finalizedNumber ? "finalized" : "included";
    const parent = block.block.header.parentHash;
    if (parent.isEmpty) break;
    block = await api.rpc.chain.getBlock(parent);
  }
  return "not-found";
}
