import { statusWithoutHash, type TxStatus } from "./tx-result.ts";

export const TX_STORAGE_KEY = "portova.session-txs.v1";
export type TrackedTx = {
  id: string; label: string; status: TxStatus; hash?: string; error?: string; collectionId?: string;
  genesisHash?: string; account?: string; createdAt?: number; checkedAt?: number;
  fromBlock?: number; blockHash?: string; blockNumber?: number; extrinsicIndex?: number;
  searchCursor?: number; recoveryRequested?: boolean; recoveryMessage?: string;
};
const PHASES = new Set<TxStatus>(["signing", "submitted", "included", "finalized", "failed", "ambiguous"]);
export const isExtrinsicHash = (value: unknown): value is string => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
const number = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const text = (value: unknown, max: number) => typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max) || undefined : undefined;

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
  };
}

export function parseTxs(raw: string | null): TrackedTx[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const item = normalizeTx(entry);
      if (!item) return [];
      if ((item.status === "signing" || item.status === "submitted") && !item.hash) {
        item.status = statusWithoutHash(item.status);
        item.error = "No transaction hash was returned. The outcome is unknown. Check the wallet before trying again.";
      }
      return [item];
    });
  } catch { return []; }
}

export function patchTx(item: TrackedTx, update: Partial<TrackedTx>): TrackedTx {
  // A late subscription or recovery page cannot demote a confirmed result.
  if ((item.status === "finalized" || item.status === "failed") && update.status && update.status !== item.status) return item;
  return normalizeTx({ ...item, ...update }) ?? item;
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
      error: "Imported record. Its outcome must be verified against the chain.", checkedAt: undefined,
      recoveryRequested: false, searchCursor: undefined, recoveryMessage: undefined }];
  });
}

export function mergeReceipts(current: TrackedTx[], incoming: TrackedTx[]): TrackedTx[] {
  const keys = new Set(current.map(receiptKey));
  return [...current, ...incoming.filter((item) => { const key = receiptKey(item); if (keys.has(key)) return false; keys.add(key); return true; })];
}
function receiptKey(item: TrackedTx) { return item.hash ? `${item.genesisHash ?? ""}:${item.hash}` : item.id; }
