import type { ApiPromise } from "@polkadot/api";
import type { SignedBlock } from "@polkadot/types/interfaces";
import { dispatchOutcome, type ChainMatch, type DispatchEvent } from "./tx-result.ts";

export { dispatchOutcome };

export type ReceiptLocation = { blockHash?: string; blockNumber?: number; extrinsicIndex?: number; collectionId?: string };
export type RecoveryOptions = { blockHash?: string; blockNumber?: number; fromBlock?: number; cursor?: number; maxBlocks?: number; signal?: AbortSignal };
export type RecoveryResult = ReceiptLocation & { chain: ChainMatch; scanned: number; nextCursor?: number; error?: string };
type Block = SignedBlock;

/** A bounded page of chain evidence. The caller persists nextCursor between pages. */
export async function reconcileReceipt(api: ApiPromise, hash: string, options: RecoveryOptions = {}): Promise<RecoveryResult> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return { chain: "unchecked", scanned: 0, error: "Enter a 32-byte transaction hash." };
  const matchHash = hash.toLowerCase();
  let scanned = 0;
  let cursor = options.cursor;
  const deadline = Date.now() + 40_000;
  const rpc = async <T>(pending: PromiseLike<T>): Promise<T> => {
    if (options.signal?.aborted) throw new Error("Recovery paused.");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopped = () => rejectWait?.(new Error("Recovery paused."));
    let rejectWait: ((cause: Error) => void) | undefined;
    try {
      return await Promise.race([Promise.resolve(pending), new Promise<never>((_, reject) => {
        rejectWait = reject;
        timer = setTimeout(() => reject(new Error("The node did not respond in time.")), Math.max(1, Math.min(12_000, deadline - Date.now())));
        options.signal?.addEventListener("abort", stopped, { once: true });
      })]);
    } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", stopped); }
  };
  try {
    // Some public nodes disable author RPCs. That must not prevent block recovery.
    try {
      const pending = await rpc(api.rpc.author.pendingExtrinsics());
      if (pending.some((tx) => tx.hash.toHex().toLowerCase() === matchHash)) return { chain: "pending", scanned };
    } catch { /* Continue with canonical block evidence. */ }
    const finalized = await rpc(api.rpc.chain.getHeader(await rpc(api.rpc.chain.getFinalizedHead())));
    const finalizedNumber = finalized.number.toNumber();

    const inspect = async (block: Block, verifyCanonical = false): Promise<RecoveryResult | null> => {
      const index = block.block.extrinsics.findIndex((tx) => tx.hash.toHex().toLowerCase() === matchHash);
      if (index < 0) return null;
      const blockNumber = block.block.header.number.toNumber();
      const blockHash = block.block.header.hash.toHex();
      if (verifyCanonical) {
        const canonical = (await rpc(api.rpc.chain.getBlockHash(blockNumber))).toHex();
        if (canonical !== blockHash) return null;
      }
      const events = await rpc(readEvents(api, block.block.header.hash));
      const dispatch = dispatchOutcome(events, index);
      const chain = dispatch === "failed" ? "failed" : dispatch !== "success" ? "dispatch-unknown" : blockNumber <= finalizedNumber ? "finalized" : "included";
      return { chain, scanned, blockHash, blockNumber, extrinsicIndex: index, collectionId: dispatch === "success" ? createdCollectionId(events, index) ?? undefined : undefined };
    };

    // An inclusion hash/height is an exact lookup, even years after submission.
    if (options.blockHash || options.blockNumber !== undefined) {
      const blockHash = options.blockHash ?? await rpc(api.rpc.chain.getBlockHash(options.blockNumber!));
      const known = await inspect(await rpc(api.rpc.chain.getBlock(blockHash)), true);
      if (known) return known;
    }
    let block = await rpc(api.rpc.chain.getBlock());
    const tip = block.block.header.number.toNumber();
    cursor = Math.min(options.cursor ?? tip, tip);
    const floor = Math.max(0, options.fromBlock ?? 0);
    const limit = Math.max(1, Math.min(options.maxBlocks ?? 32, 256));
    if (cursor < floor) return { chain: "not-found", scanned };
    if (cursor !== tip) block = await rpc(api.rpc.chain.getBlock(await rpc(api.rpc.chain.getBlockHash(cursor))));
    for (let i = 0; i < limit; i += 1) {
      if (options.signal?.aborted) return { chain: "unchecked", scanned, nextCursor: cursor, error: "Recovery paused." };
      cursor = block.block.header.number.toNumber();
      if (cursor < floor) break;
      scanned += 1;
      const found = await inspect(block);
      if (found) return { ...found, scanned };
      const parent = block.block.header.parentHash;
      if (cursor === floor || cursor === 0 || parent.isEmpty) return { chain: "not-found", scanned };
      cursor -= 1;
      if (i === limit - 1) return { chain: "not-found", scanned, nextCursor: cursor };
      block = await rpc(api.rpc.chain.getBlock(parent));
    }
    return { chain: "not-found", scanned };
  } catch {
    return { chain: "unchecked", scanned, nextCursor: cursor, error: "The node could not serve this block or its history. Try a known inclusion block or resume later." };
  }
}

export async function reconcileExtrinsic(api: ApiPromise, hash: string, lookback = 24): Promise<ChainMatch> {
  return (await reconcileReceipt(api, hash, { maxBlocks: lookback })).chain;
}

export async function collectionIdForHash(api: ApiPromise, hash: string, lookback = 24): Promise<string | null> {
  const result = await reconcileReceipt(api, hash, { maxBlocks: lookback });
  return result.chain === "finalized" || result.chain === "included" ? result.collectionId ?? null : null;
}

function createdCollectionId(events: DispatchEvent[], index: number): string | null {
  for (const record of events) {
    if (applyIndex(record) !== index || record.event.section !== "nfts" || record.event.method !== "Created") continue;
    const id = record.event.data?.[0]?.toString?.().replace(/,/g, "") ?? "";
    if (/^\d+$/.test(id)) return id;
  }
  return null;
}

function applyIndex(record: DispatchEvent): number | null {
  const phase = record.phase;
  if (!phase?.isApplyExtrinsic) return typeof phase?.ApplyExtrinsic === "number" ? phase.ApplyExtrinsic : null;
  const value = phase.asApplyExtrinsic;
  return typeof value === "number" ? value : value?.toNumber?.() ?? null;
}

async function readEvents(api: ApiPromise, blockHash: { toHex(): string }): Promise<DispatchEvent[]> {
  try { return (await api.query.system.events.at(blockHash as never)) as unknown as DispatchEvent[]; }
  catch { return []; }
}
