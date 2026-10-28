"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { isExtrinsicHash, txStatusLabel, useTxs, type TrackedTx } from "@/components/tx/tx-tracker";
import { Button, PageIntro, Panel, StatusPill } from "@/components/ui";
import { readTradingEnabled } from "@/lib/market";
import { BLOCK_EXPLORER, TESTNET_GENESIS } from "@/lib/network";
import { receiptExplorerUrl } from "@/lib/explorer";
import { exportReceipts } from "@/lib/tx-storage";
import { formatUnits } from "@/lib/format";
import { BUILD_CALLS } from "@/lib/reconciliation";

const FIELD = "mt-1.5 h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-xs";
export function ActivityScreen() {
  const chain = useChain();
  const txs = useTxs();
  const [trading, setTrading] = useState<boolean | null>(null);
  const [hash, setHash] = useState("");
  const [height, setHeight] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const api = chain.getApi();
    if (chain.status === "live" && api) setTrading(readTradingEnabled(api));
  }, [chain.status, chain.getApi]);

  function lookup(event: React.FormEvent) {
    event.preventDefault(); setMessage(null);
    if (!isExtrinsicHash(hash.trim())) { setMessage("Enter a transaction hash with 0x and 64 hexadecimal characters."); return; }
    const blockNumber = height.trim() ? Number(height) : undefined;
    if (blockNumber !== undefined && (!/^\d+$/.test(height.trim()) || !Number.isSafeInteger(blockNumber))) { setMessage("The inclusion block must be a whole block number."); return; }
    const existing = txs.items.find((item) => item.hash?.toLowerCase() === hash.trim().toLowerCase());
    if (existing && ["finalized", "failed"].includes(existing.status)) { setMessage("This hash already has a recorded result below."); return; }
    const record = { ...(blockNumber !== undefined ? { blockHash: undefined, blockNumber } : {}), fromBlock: 0, recoveryRequested: true, checkedAt: undefined, searchCursor: undefined, recoveryMessage: "Recovery queued. This does not submit a transaction." };
    if (existing) txs.patch(existing.id, record);
    else txs.push({ id: crypto.randomUUID(), label: "Transaction lookup", status: "ambiguous", hash: hash.trim(), genesisHash: TESTNET_GENESIS, ...record });
    setMessage(blockNumber === undefined ? "Searching older blocks in resumable pages. A known inclusion block is much faster." : `Checking block ${blockNumber} and its dispatch events.`);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([exportReceipts(txs.items, TESTNET_GENESIS)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `portova-receipts-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("Use a backup smaller than 2 MB.");
      const added = txs.importBackup(await file.text()); setMessage(`Imported ${added} new receipts. Imported outcomes are rechecked against the chain.`);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "The receipt backup could not be read."); }
    event.target.value = "";
  }
  return <div className="space-y-6">
    <PageIntro eyebrow="Activity" title="Every move, accounted for." body="Your receipts stay in this browser. Inclusion blocks are saved for direct recovery after a reload; older searches resume from their last checkpoint. A finalized result requires the matching successful dispatch in a finalized block." />
    {txs.storageError && <p role="alert" className="text-sm text-warn">{txs.storageError}</p>}
    <Panel className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-medium">Recover a transaction</h2><a href={BLOCK_EXPLORER} target="_blank" rel="noreferrer" className="text-xs text-violet">Open testnet explorer ↗</a></div><form onSubmit={lookup} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"><label className="text-xs text-muted">Transaction hash<input className={FIELD} value={hash} onChange={(event) => setHash(event.target.value)} placeholder="0x…" spellCheck={false} /></label><label className="text-xs text-muted">Inclusion block (optional)<input className={FIELD} value={height} onChange={(event) => setHeight(event.target.value)} inputMode="numeric" placeholder="e.g. 159687" /></label><Button type="submit" disabled={chain.status !== "live" || !txs.ready}>Find receipt</Button></form><p className="text-xs leading-6 text-faint">Find the inclusion block in the official explorer for a direct lookup. Without it, searches read up to 64 blocks per page and save progress. Recovery continues across app pages. Pruned node history stays unverified.</p><div className="flex flex-wrap items-center gap-3"><Button onClick={download} disabled={!txs.ready || !txs.items.length}>Export receipts</Button><label className="cursor-pointer rounded-xl border border-line px-4 py-2.5 text-sm">Import backup<input type="file" accept="application/json,.json" onChange={(event) => void importFile(event)} className="sr-only" aria-label="Import receipt backup" /></label><StatusPill tone={txs.recovering ? "warn" : "muted"}>{txs.recovering ? "Checking chain" : "Ready"}</StatusPill></div>{message && <p role="status" className="text-xs leading-6 text-muted">{message}</p>}</Panel>
    <Panel><div className="border-b border-line px-5 py-4"><h2 className="text-sm font-medium">Saved receipts <span className="ml-2 text-faint">{txs.items.length}</span></h2></div>{!txs.ready ? <p className="p-5 text-sm text-muted">Reading saved receipts…</p> : !txs.items.length ? <p className="p-5 text-sm text-muted">Your first transaction will appear here. You can also recover an existing hash above.</p> : <ul>{txs.items.map((item) => <SessionRow key={item.id} item={item} />)}</ul>}</Panel>
    <Panel className="p-5"><h2 className="text-sm font-medium">Live network capabilities</h2><p className="mt-3 text-xs leading-6 text-muted">{countLine("assets", chain.assets?.length ?? null)}, {countLine("collections", chain.collectionCount)}, {countLine("pools", chain.poolCount)}. NFT Trading {trading === null ? "has not been read" : trading ? "is enabled" : "is disabled"}.</p><details className="mt-4 text-xs text-muted"><summary className="cursor-pointer text-violet">View supported call catalog</summary><ul className="mt-3 space-y-3">{BUILD_CALLS.map((row) => <li key={row.id}><p className="font-mono break-all">{row.call}</p><p className="mt-1 leading-6 text-faint">{row.detail}</p></li>)}</ul></details><p className="mt-4 text-xs leading-6 text-faint">These are browser receipts, not a full network index. Export a backup for another device. An explorer link provides independent inspection; an imported status is never accepted as chain proof.</p></Panel>
  </div>;
}
function SessionRow({ item }: { item: TrackedTx }) {
  const txs = useTxs();
  const href = item.hash ? receiptExplorerUrl(item.hash) : null;
  const open = !!item.hash && ["submitted", "included", "ambiguous"].includes(item.status);
  return <li className="space-y-2 border-b border-line p-5 last:border-0"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-medium">{item.label}</h3><StatusPill tone={item.status === "finalized" ? "ok" : item.status === "failed" ? "bad" : "warn"}>{txStatusLabel(item.status)}</StatusPill></div>{item.hash ? <p className="font-mono text-xs break-all text-muted">{item.hash}</p> : <p className="text-xs text-faint">No hash returned. Check the wallet before trying again.</p>}{item.account && <p className="font-mono text-[10px] break-all text-faint">Account {item.account}</p>}<p className="text-[10px] text-faint">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Legacy browser receipt"}{item.blockNumber !== undefined ? ` · Block ${item.blockNumber}` : ""}{item.extrinsicIndex !== undefined ? ` · Extrinsic ${item.extrinsicIndex}` : ""}</p>{item.error && <p className="text-xs leading-6 text-warn">{item.error}</p>}<FeeSummary item={item} />{item.recoveryMessage && <p className="text-xs leading-6 text-muted">{item.recoveryMessage}</p>}<div className="flex flex-wrap gap-4 text-xs">{href && <a href={href} target="_blank" rel="noreferrer" className="text-violet">Inspect in explorer ↗</a>}{open && <button type="button" className="text-violet" onClick={() => txs.requestRecovery(item.id, !item.recoveryRequested)}>{item.recoveryRequested ? "Pause older-block search" : item.searchCursor !== undefined ? "Resume older-block search" : "Search older blocks"}</button>}</div></li>;
}
function countLine(label: string, value: number | null) { return value === null ? `${label} unavailable` : `${value} ${label}`; }

function FeeSummary({ item }: { item: TrackedTx }) {
  if (!item.estimatedFee && !item.actualFee) return null;
  const shown = (raw: string) => `${formatUnits(raw, 14, 14)} tPOT`;
  return <div className="space-y-1 rounded-lg border border-line p-3 text-xs text-muted">
    {item.estimatedFee && <div>Pre-sign fee estimate: <span className="font-mono">{shown(item.estimatedFee)}</span></div>}
    {item.feeBudget && <div>Reviewed fee budget: <span className="font-mono">{shown(item.feeBudget)}</span></div>}
    {item.actualFee && <div>Charged fee from matching chain event: <span className="font-mono">{shown(item.actualFee)}</span></div>}
    {item.estimatedFee && item.actualFee && <div>Actual minus estimate: <span className="font-mono">{shown((BigInt(item.actualFee) - BigInt(item.estimatedFee)).toString())}</span></div>}
    {item.runtimeVersion && <div className="text-faint">{item.runtimeVersion}{item.call ? ` · ${item.call}` : ""}</div>}
  </div>;
}
