import { statusWithoutHash, type TxStatus } from "./tx-result.ts";

export const TX_STORAGE_KEY = "portova.session-txs.v1";
export type TrackedTx = {
  id: string; label: string; status: TxStatus; hash?: string; error?: string; collectionId?: string;
  genesisHash?: string; account?: string; createdAt?: number; checkedAt?: number;
  fromBlock?: number; blockHash?: string; blockNumber?: number; extrinsicIndex?: number;
  searchCursor?: number; recoveryRequested?: boolean; recoveryMessage?: string;
  estimatedFee?: string; feeBudget?: string; actualFee?: string; feeTip?: string; preflightBlockHash?: string; runtimeVersion?: string; call?: string;
  updatedAt?: number; changeId?: string;
  projectId?: string; projectField?: "assetId" | "collectionId" | "poolLpToken"; objectId?: string;
};
const PHASES = new Set<TxStatus>(["signing", "submitted", "included", "finalized", "failed", "ambiguous"]);
export const isExtrinsicHash = (value: unknown): value is string => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
const number = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const text = (value: unknown, max: number) => typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max) || undefined : undefined;
const fee = (value: unknown) => typeof value === "string" && /^\d{1,39}$/.test(value) ? value : undefined;

export function normalizeTx(entry: unknown): TrackedTx | null {
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Partial<TrackedTx>;
  const id = text(record.id, 100), label = text(record.label, 160);
  if (!id || !label || !record.status || !PHASES.has(record.status)) return null;
  if (record.hash !== undefined && !isExtrinsicHash(record.hash)) return null;
  return {
    id, label, status: record.status, hash: record.hash?.toLowerCase(), error: text(record.error, 600),
    collectionId: typeof record.collectionId === "string" && /^\d+$/.test(record.collectionId) ? record.collectionId : undefined,
    genesisHash: isExtrinsicHash(record.genesisHash) ? record.genesisHash.toLowerCase() : undefined,
    account: text(record.account, 100), createdAt: number(record.createdAt), checkedAt: number(record.checkedAt),
    fromBlock: number(record.fromBlock), blockHash: isExtrinsicHash(record.blockHash) ? record.blockHash.toLowerCase() : undefined,
    blockNumber: number(record.blockNumber), extrinsicIndex: number(record.extrinsicIndex), searchCursor: number(record.searchCursor),
    recoveryRequested: record.recoveryRequested === true, recoveryMessage: text(record.recoveryMessage, 400),
    estimatedFee: fee(record.estimatedFee), feeBudget: fee(record.feeBudget), actualFee: fee(record.actualFee), feeTip: fee(record.feeTip),
    updatedAt: number(record.updatedAt), changeId: text(record.changeId, 100),
    projectId: text(record.projectId, 80), projectField: record.projectField && ["assetId", "collectionId", "poolLpToken"].includes(record.projectField) ? record.projectField : undefined,
    objectId: typeof record.objectId === "string" && /^\d{1,10}$/.test(record.objectId) ? record.objectId : undefined,
    preflightBlockHash: isExtrinsicHash(record.preflightBlockHash) ? record.preflightBlockHash : undefined, runtimeVersion: text(record.runtimeVersion, 100), call: text(record.call, 100),
  };
}

export function parseTxs(raw: string | null, restorePending = true): TrackedTx[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const item = normalizeTx(entry);
      if (!item) return [];
      if (restorePending && (item.status === "signing" || item.status === "submitted") && !item.hash) {
        item.status = statusWithoutHash(item.status);
        item.error = "No transaction hash was returned. The outcome is unknown. Check the wallet before trying again.";
      }
      return [item];
    });
  } catch { return []; }
}

/** Merge concurrent tabs by revision while preserving verified terminal outcomes and every receipt. */
export function mergeLiveReceipts(left: TrackedTx[], right: TrackedTx[]): TrackedTx[] {
  const rows = [...left];
  for (const incoming of right) {
    const index = rows.findIndex(row => row.id === incoming.id || (!!incoming.hash && row.hash === incoming.hash && row.genesisHash === incoming.genesisHash));
    if (index < 0) { rows.push(incoming); continue; }
    const current = rows[index];
    const terminal = (row: TrackedTx) => row.status === "finalized" || row.status === "failed";
    if (terminal(current) && !terminal(incoming)) continue;
    const newer = (incoming.updatedAt ?? incoming.createdAt ?? 0) > (current.updatedAt ?? current.createdAt ?? 0)
      || ((incoming.updatedAt ?? incoming.createdAt ?? 0) === (current.updatedAt ?? current.createdAt ?? 0) && (incoming.changeId ?? "") > (current.changeId ?? ""));
    if (newer || (!terminal(current) && terminal(incoming))) rows[index] = { ...patchTx(current, incoming), id: current.id };
  }
  return rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export function patchTx(item: TrackedTx, update: Partial<TrackedTx>): TrackedTx {
  // A late subscription or recovery page cannot demote a confirmed result.
  if ((item.status === "finalized" || item.status === "failed") && update.status && update.status !== item.status) return item;
  const stable = ["actualFee", "feeTip", "account", "blockHash", "blockNumber", "extrinsicIndex", "collectionId", "projectId", "projectField", "objectId"] as const;
  const evidence = item.status === "finalized" || item.status === "failed"
    ? Object.fromEntries(stable.filter(key => update[key] === undefined && item[key] !== undefined).map(key => [key, item[key]])) : {};
  return normalizeTx({ ...item, ...update, ...evidence }) ?? item;
}

export function exportReceipts(items: TrackedTx[], genesisHash: string): string {
  return JSON.stringify({ version: 1, genesisHash, exportedAt: new Date().toISOString(), receipts: items }, null, 2);
}

export function importReceipts(raw: string, genesisHash: string): TrackedTx[] {
  if (raw.length > 2_000_000) throw new Error("Use a receipt backup smaller than 2 MB.");
  const data = JSON.parse(raw) as { version?: number; genesisHash?: string; receipts?: unknown[] };
  if (!data || data.version !== 1 || data.genesisHash?.toLowerCase() !== genesisHash.toLowerCase() || !Array.isArray(data.receipts)) {
    throw new Error("This is not a Portova receipt backup for the connected network.");
  }
  if (data.receipts.length > 5_000) throw new Error("Import at most 5,000 receipts at a time.");
  return data.receipts.flatMap((entry) => {
    const item = normalizeTx(entry);
    if (!item || (item.genesisHash && item.genesisHash !== genesisHash.toLowerCase())) return [];
    return [{ ...item, id: crypto.randomUUID(), genesisHash: genesisHash.toLowerCase(), status: "ambiguous" as const,
      actualFee: undefined, feeTip: undefined, account: undefined,
      projectId: undefined, projectField: undefined, objectId: undefined, updatedAt: Date.now(), changeId: crypto.randomUUID(),
      error: "Imported record. Its outcome must be verified against the chain.", checkedAt: undefined,
      recoveryRequested: false, searchCursor: undefined, recoveryMessage: undefined }];
  });
}

export function mergeReceipts(current: TrackedTx[], incoming: TrackedTx[]): TrackedTx[] {
  const keys = new Set(current.map(receiptKey));
  return [...current, ...incoming.filter((item) => { const key = receiptKey(item); if (keys.has(key)) return false; keys.add(key); return true; })];
}
function receiptKey(item: TrackedTx) { return item.hash ? `${item.genesisHash ?? ""}:${item.hash}` : item.id; }
