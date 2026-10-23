import type { ApiPromise } from "@polkadot/api";
import { dispatchOutcome, type ChainMatch, type DispatchEvent } from "./tx-result.ts";

export { dispatchOutcome };

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
    const index = block.block.extrinsics.findIndex((extrinsic) => extrinsic.hash.toHex() === hash);
    if (index >= 0) {
      const dispatch = await readDispatch(api, block.block.header.hash, index);
      if (dispatch === "failed") return "failed";
      if (dispatch !== "success") return "dispatch-unknown";
      return block.block.header.number.toNumber() <= finalizedNumber ? "finalized" : "included";
    }
    const parent = block.block.header.parentHash;
    if (parent.isEmpty) break;
    block = await api.rpc.chain.getBlock(parent);
  }
  return "not-found";
}

async function readDispatch(api: ApiPromise, blockHash: { toHex(): string }, index: number): Promise<"success" | "failed" | "unknown"> {
  try {
    const events = (await api.query.system.events.at(blockHash as never)) as unknown as DispatchEvent[];
    return dispatchOutcome(events, index);
  } catch {
    return "unknown";
  }
}
