"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { TESTNET_GENESIS } from "@/lib/network";
import { TX_STORAGE_KEY, normalizeTx, parseTxs, patchTx, importReceipts, mergeReceipts, mergeLiveReceipts, type TrackedTx } from "@/lib/tx-storage";
import { withBrowserLock } from "@/lib/browser-lock";
import { reconcileReceipt } from "@/lib/tx-reconcile";
import { outcomeAfterWait } from "@/lib/tx-result";
export { isExtrinsicHash, type TrackedTx } from "@/lib/tx-storage";

export function txStatusLabel(status: string): string {
  return ({ signing: "Waiting for signature", submitted: "Submitted", included: "Included", finalized: "Finalized", failed: "Failed", ambiguous: "Unknown" } as Record<string, string>)[status] ?? "Unknown";
}

type TxValue = {
  ready: boolean; items: TrackedTx[]; storageError: string | null; recovering: boolean;
  push: (item: TrackedTx) => void; patch: (id: string, update: Partial<TrackedTx>) => void;
  requestRecovery: (id: string, enabled?: boolean) => void; importBackup: (raw: string) => number;
};
const TxContext = createContext<TxValue | null>(null);

export function TxProvider({ children }: { children: React.ReactNode }) {
  const chain = useChain();
  const wallet = useSubstrateWallet();
  const context = useRef({ chain, wallet });
  context.current = { chain, wallet };
  const [items, setItems] = useState<TrackedTx[]>([]);
  const itemsRef = useRef(items); itemsRef.current = items;
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const recoveryBusy = useRef(false);
  const alive = useRef(true);
  const [tick, setTick] = useState(0);
  const persistQueue = useRef(Promise.resolve());
  useEffect(() => {
    alive.current = true;
    try { setItems(parseTxs(window.localStorage.getItem(TX_STORAGE_KEY))); }
    catch { setStorageError("Browser storage is unavailable. Export your receipts before closing this page."); }
    setReady(true);
    const timer = window.setInterval(() => setTick((value) => value + 1), 5_000);
    const synchronize = (event: StorageEvent) => {
      if (event.key === TX_STORAGE_KEY) setItems(current => { const merged = mergeLiveReceipts(current, parseTxs(event.newValue, false)); return JSON.stringify(merged) === JSON.stringify(current) ? current : merged; });
    };
    window.addEventListener("storage", synchronize);
    return () => { alive.current = false; window.clearInterval(timer); window.removeEventListener("storage", synchronize); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    persistQueue.current = persistQueue.current.then(() => withBrowserLock("portova:receipts", () => {
      const merged = mergeLiveReceipts(parseTxs(window.localStorage.getItem(TX_STORAGE_KEY), false), itemsRef.current);
      const raw = JSON.stringify(merged);
      if (window.localStorage.getItem(TX_STORAGE_KEY) !== raw) window.localStorage.setItem(TX_STORAGE_KEY, raw);
      if (alive.current) { setStorageError(null); setItems(current => { const combined = mergeLiveReceipts(current, merged); return JSON.stringify(current) === JSON.stringify(combined) ? current : combined; }); }
    })).catch(() => { if (alive.current) setStorageError("Receipt storage or tab coordination is unavailable. New receipts are in memory; export a backup before closing this page."); });
  }, [items, ready]);

  const push = useCallback((item: TrackedTx) => {
    const { chain, wallet } = context.current;
    const start = Number(chain.blockNumber);
    const next = normalizeTx({ ...item, createdAt: item.createdAt ?? Date.now(), updatedAt: Date.now(), changeId: crypto.randomUUID(),
      genesisHash: item.genesisHash ?? chain.getApi()?.genesisHash.toHex() ?? TESTNET_GENESIS,
      account: item.account ?? wallet.selected?.address,
      fromBlock: item.fromBlock ?? (chain.blockNumber && Number.isSafeInteger(start) ? Math.max(0, start - 2) : undefined) });
    if (next) setItems((current) => [next, ...current.filter((row) => row.id !== next.id)]);
  }, []);
  const patch = useCallback((id: string, update: Partial<TrackedTx>) => setItems((current) => current.map((item) => item.id === id ? patchTx(item, { ...update, updatedAt: Date.now(), changeId: crypto.randomUUID() }) : item)), []);
  const requestRecovery = useCallback((id: string, enabled = true) => patch(id, { recoveryRequested: enabled, checkedAt: undefined, recoveryMessage: enabled ? "Searching the connected chain…" : "Older-block search paused." }), [patch]);
  const importBackup = useCallback((raw: string) => {
    const incoming = importReceipts(raw, TESTNET_GENESIS);
    const merged = mergeReceipts(itemsRef.current, incoming);
    const added = merged.length - itemsRef.current.length;
    setItems(current => mergeReceipts(current, incoming)); return added;
  }, []);

  useEffect(() => {
    const api = chain.getApi();
    if (!ready || chain.status !== "live" || !api || recoveryBusy.current || api.genesisHash.toHex() !== TESTNET_GENESIS) return;
    const item = items.filter((row) => row.hash && ["submitted", "included", "ambiguous"].includes(row.status)
      && (!row.genesisHash || row.genesisHash === TESTNET_GENESIS)
      && (!row.checkedAt || Date.now() - row.checkedAt >= (row.recoveryRequested ? 5_000 : 20_000)))
      .sort((a, b) => Number(!!b.recoveryRequested) - Number(!!a.recoveryRequested) || (a.checkedAt ?? 0) - (b.checkedAt ?? 0))[0];
    if (!item?.hash) return;
    recoveryBusy.current = true; setRecovering(true);
    void reconcileReceipt(api, item.hash, {
      blockHash: item.blockHash, blockNumber: item.blockNumber, fromBlock: item.fromBlock,
      cursor: item.recoveryRequested || item.fromBlock !== undefined ? item.searchCursor : undefined,
      maxBlocks: item.recoveryRequested ? 64 : 24,
    }).then((result) => {
      if (!alive.current || context.current.chain.getApi() !== api) return;
      // A manual block hint or a newer subscription supersedes this in-flight read.
      const latest = itemsRef.current.find(row => row.id === item.id);
      if (!latest || latest.changeId !== item.changeId) return;
      const settled = result.chain === "finalized" || result.chain === "failed";
      const next = result.chain === "unchecked" ? {} : outcomeAfterWait({ hash: item.hash, sawIncluded: item.status === "included", chain: result.chain });
      patch(item.id, { ...next, genesisHash: TESTNET_GENESIS, checkedAt: Date.now(),
        blockHash: result.blockHash ?? item.blockHash, blockNumber: result.blockNumber ?? item.blockNumber,
        extrinsicIndex: result.extrinsicIndex ?? item.extrinsicIndex, collectionId: result.collectionId ?? item.collectionId,
        actualFee: result.actualFee ?? item.actualFee, feeTip: result.feeTip ?? item.feeTip,
        account: settled ? result.account : item.account,
        searchCursor: result.nextCursor,
        recoveryRequested: !settled && item.recoveryRequested && result.nextCursor !== undefined && result.chain !== "unchecked",
        recoveryMessage: result.error ?? (settled ? "Verified from this extrinsic's block and dispatch events." : result.nextCursor !== undefined ? `Searched ${result.scanned} blocks. Next page starts at block ${result.nextCursor}.` : "The searched range did not establish an outcome. Supply an inclusion block or consult the explorer."),
      });
    }).catch(() => {
      if (alive.current) patch(item.id, { checkedAt: Date.now(), recoveryRequested: false, recoveryMessage: "Recovery could not complete. Resume later or supply an inclusion block." });
    }).finally(() => { recoveryBusy.current = false; if (alive.current) setRecovering(false); });
  }, [ready, items, tick, chain.status, chain.blockNumber, chain.getApi, patch]);

  const value = useMemo(() => ({ ready, items, storageError, recovering, push, patch, requestRecovery, importBackup }), [ready, items, storageError, recovering, push, patch, requestRecovery, importBackup]);
  return <TxContext.Provider value={value}>{children}</TxContext.Provider>;
}
export function useTxs(): TxValue {
  const value = useContext(TxContext);
  if (!value) throw new Error("useTxs must be used inside TxProvider");
  return value;
}
