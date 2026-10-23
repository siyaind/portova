import type { ApiPromise } from "@polkadot/api";
import { dispatchOutcome, type ChainMatch, type DispatchEvent } from "./tx-result.ts";

export { dispatchOutcome };

export async function reconcileExtrinsic(
  api: ApiPromise,
  hash: string,
  lookback = 24,
): Promise<ChainMatch> {
  const found = await findExtrinsic(api, hash, lookback);
  return found?.chain ?? "not-found";
}

export async function collectionIdForHash(api: ApiPromise, hash: string, lookback = 24): Promise<string | null> {
  const found = await findExtrinsic(api, hash, lookback);
  if (!found || (found.chain !== "finalized" && found.chain !== "included")) return null;
  return createdCollectionId(found.events, found.index);
}

async function findExtrinsic(
  api: ApiPromise,
  hash: string,
  lookback: number,
): Promise<{ chain: ChainMatch; index: number; events: DispatchEvent[] } | null> {
  const pending = await api.rpc.author.pendingExtrinsics();
  if (pending.some((extrinsic) => extrinsic.hash.toHex() === hash)) {
    return { chain: "pending", index: -1, events: [] };
  }
  const finalizedHeader = await api.rpc.chain.getHeader(await api.rpc.chain.getFinalizedHead());
  const finalizedNumber = finalizedHeader.number.toNumber();
  let block = await api.rpc.chain.getBlock();
  for (let i = 0; i < lookback; i += 1) {
    const index = block.block.extrinsics.findIndex((extrinsic) => extrinsic.hash.toHex() === hash);
    if (index >= 0) {
      const events = await readEvents(api, block.block.header.hash);
      const dispatch = dispatchOutcome(events, index);
      if (dispatch === "failed") return { chain: "failed", index, events };
      if (dispatch !== "success") return { chain: "dispatch-unknown", index, events };
      const chain = block.block.header.number.toNumber() <= finalizedNumber ? "finalized" : "included";
      return { chain, index, events };
    }
    const parent = block.block.header.parentHash;
    if (parent.isEmpty) break;
    block = await api.rpc.chain.getBlock(parent);
  }
  return null;
}

function createdCollectionId(events: DispatchEvent[], index: number): string | null {
  for (const record of events) {
    if (applyIndex(record) !== index) continue;
    if (record.event.section !== "nfts" || record.event.method !== "Created") continue;
    const id = record.event.data?.[0]?.toString?.().replace(/,/g, "") ?? "";
    if (/^\d+$/.test(id)) return id;
  }
  return null;
}

function applyIndex(record: DispatchEvent): number | null {
  const phase = record.phase;
  if (!phase?.isApplyExtrinsic) return typeof phase?.ApplyExtrinsic === "number" ? phase.ApplyExtrinsic : null;
  const value = phase.asApplyExtrinsic;
  if (typeof value === "number") return value;
  return value?.toNumber?.() ?? null;
}

async function readEvents(api: ApiPromise, blockHash: { toHex(): string }): Promise<DispatchEvent[]> {
  try {
    return (await api.query.system.events.at(blockHash as never)) as unknown as DispatchEvent[];
  } catch {
    return [];
  }
}
