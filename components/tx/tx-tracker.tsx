"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { TxPhase } from "@/lib/assets";
import { statusWithoutHash } from "@/lib/tx-result";

const STORAGE_KEY = "portova.session-txs.v1";
const LIMIT = 40;

export type TrackedTx = {
  id: string;
  label: string;
  status: TxPhase;
  hash?: string;
  error?: string;
  collectionId?: string;
};

type TxValue = {
  ready: boolean;
  items: TrackedTx[];
  push: (item: TrackedTx) => void;
  patch: (id: string, update: Partial<TrackedTx>) => void;
};

const PHASES = new Set<TxPhase>(["signing", "submitted", "included", "finalized", "failed", "ambiguous"]);

const TxContext = createContext<TxValue | null>(null);

export function txStatusLabel(status: string): string {
  if (status === "signing") return "Waiting for signature";
  if (status === "submitted") return "Submitted";
  if (status === "included") return "Included";
  if (status === "finalized") return "Finalized";
  if (status === "failed") return "Failed";
  if (status === "ambiguous") return "Unknown";
  return "Unknown";
}

export function isExtrinsicHash(value: string | undefined): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f]/g, "").trim();
  if (!text) return null;
  return text.slice(0, max);
}

function parseTxs(raw: string | null): TrackedTx[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items: TrackedTx[] = [];
    for (const entry of parsed) {
      const item = normalizeTx(entry);
      if (item) items.push(settleStale(item));
      if (items.length === LIMIT) break;
    }
    return items;
  } catch {
    return [];
  }
}

function normalizeTx(entry: unknown): TrackedTx | null {
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Partial<TrackedTx>;
  const id = cleanText(record.id, 80);
  const label = cleanText(record.label, 160);
  if (!id || !label || !record.status || !PHASES.has(record.status)) return null;
  if (record.hash !== undefined && !isExtrinsicHash(record.hash)) return null;
  const hash = record.hash;
  const error = cleanText(record.error, 400) ?? undefined;
  const collectionId =
    typeof record.collectionId === "string" && /^\d+$/.test(record.collectionId)
      ? record.collectionId
      : undefined;
  return { id, label, status: record.status, hash, error, collectionId };
}

function settleStale(item: TrackedTx): TrackedTx {
  if ((item.status === "signing" || item.status === "submitted") && !item.hash) {
    return {
      ...item,
      status: statusWithoutHash(item.status),
      error: "No transaction hash was returned. The outcome is unknown, and this is not proof the transaction failed.",
    };
  }
  return item;
}

export function TxProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<TrackedTx[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(parseTxs(window.localStorage.getItem(STORAGE_KEY)));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  const push = useCallback((item: TrackedTx) => {
    const next = normalizeTx(item);
    if (!next) return;
    setItems((current) => [next, ...current.filter((row) => row.id !== next.id)].slice(0, LIMIT));
  }, []);

  const patch = useCallback((id: string, update: Partial<TrackedTx>) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        return normalizeTx({ ...item, ...update }) ?? item;
      }),
    );
  }, []);

  const value = useMemo(() => ({ ready, items, push, patch }), [ready, items, push, patch]);
  return <TxContext.Provider value={value}>{children}</TxContext.Provider>;
}

export function useTxs(): TxValue {
  const value = useContext(TxContext);
  if (!value) throw new Error("useTxs must be used inside TxProvider");
  return value;
}
