import type { TxStatus } from "@/lib/tx-result";

export type RunStepName = "token" | "nft" | "pool" | "liquidity" | "swap";

export type RunEvidence = {
  step: RunStepName;
  label: string;
  status: TxStatus;
  hash?: string;
  error?: string;
  refId?: string;
};

const STEPS = new Set<RunStepName>(["token", "nft", "pool", "liquidity", "swap"]);
const STATUSES = new Set<TxStatus>(["signing", "submitted", "included", "finalized", "failed", "ambiguous"]);

export function parseRun(raw: string | null): RunEvidence[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const item = normalizeEvidence(entry);
      return item ? [item] : [];
    }).slice(0, 20);
  } catch {
    return [];
  }
}

export function rememberEvidence(current: RunEvidence[], next: RunEvidence): RunEvidence[] {
  const item = normalizeEvidence(next);
  if (!item) return current;
  return [item, ...current].slice(0, 20);
}

function normalizeEvidence(entry: unknown): RunEvidence | null {
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Partial<RunEvidence>;
  if (!record.step || !STEPS.has(record.step) || !record.status || !STATUSES.has(record.status)) return null;
  const label = typeof record.label === "string" ? record.label.trim().slice(0, 160) : "";
  if (!label) return null;
  const hash = typeof record.hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(record.hash) ? record.hash : undefined;
  const error = typeof record.error === "string" ? record.error.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 400) : "";
  const refId = typeof record.refId === "string" && /^\d+$/.test(record.refId) ? record.refId : undefined;
  return { step: record.step, label, status: record.status, hash, error: error || undefined, refId };
}
