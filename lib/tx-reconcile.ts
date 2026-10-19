import type { ApiPromise } from "@polkadot/api";
import type { ChainMatch } from "@/lib/tx-result";

type Phase = {
  isApplyExtrinsic?: boolean;
  asApplyExtrinsic?: { toNumber?: () => number } | number;
  ApplyExtrinsic?: number;
};

type EventRecord = {
  phase: Phase;
  event: { section: string; method: string };
};

export function dispatchOutcome(events: EventRecord[], index: number): "success" | "failed" | "unknown" {
  for (const record of events) {
    if (applyExtrinsicIndex(record.phase) !== index) continue;
    if (record.event.section !== "system") continue;
    if (record.event.method === "ExtrinsicFailed") return "failed";
    if (record.event.method === "ExtrinsicSuccess") return "success";
  }
  return "unknown";
}

function applyExtrinsicIndex(phase: Phase): number | null {
  if (phase.isApplyExtrinsic) {
    const value = phase.asApplyExtrinsic;
    if (typeof value === "number") return value;
    const number = value?.toNumber?.();
    return typeof number === "number" ? number : null;
  }
  return typeof phase.ApplyExtrinsic === "number" ? phase.ApplyExtrinsic : null;
}

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
    const events = (await api.query.system.events.at(blockHash as never)) as unknown as EventRecord[];
    return dispatchOutcome(events, index);
  } catch {
    return "unknown";
  }
}
