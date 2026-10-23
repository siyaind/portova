"use client";

import { useEffect, useRef, useState } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { isExtrinsicHash, txStatusLabel, useTxs, type TrackedTx } from "@/components/tx/tx-tracker";
import { PageIntro, Panel, StatusPill } from "@/components/ui";
import { readTradingEnabled } from "@/lib/market";
import { reconcileExtrinsic } from "@/lib/tx-reconcile";
import { outcomeAfterWait } from "@/lib/tx-result";
import { NODE_CONSOLE } from "@/lib/network";
import { BUILD_CALLS } from "@/lib/reconciliation";

export function ActivityScreen() {
  const chain = useChain();
  const txs = useTxs();
  const [trading, setTrading] = useState<boolean | null>(null);
  const checking = useRef(new Set<string>());

  useEffect(() => {
    const api = chain.getApi();
    if (!txs.ready || chain.status !== "live" || !api || !chain.blockNumber) return;
    const open = txs.items.filter(
      (item) =>
        isExtrinsicHash(item.hash) &&
        (item.status === "submitted" || item.status === "included" || item.status === "ambiguous") &&
        !checking.current.has(item.id),
    );
    if (open.length === 0) return;
    for (const item of open) {
      const hash = item.hash;
      if (!isExtrinsicHash(hash)) continue;
      checking.current.add(item.id);
      void reconcileExtrinsic(api, hash)
        .then((found) => {
          if (found === "unchecked") return;
          const next = outcomeAfterWait({
            hash,
            sawIncluded: item.status === "included",
            chain: found,
          });
          if (next.status !== item.status || next.error !== item.error) {
            txs.patch(item.id, { status: next.status, hash: next.hash, error: next.error });
          }
        })
        .catch(() => undefined)
        .finally(() => {
          checking.current.delete(item.id);
        });
    }
  }, [txs, chain.status, chain.blockNumber, chain]);

  useEffect(() => {
    const api = chain.getApi();
    if (chain.status !== "live" || !api) return;
    setTrading(readTradingEnabled(api));
  }, [chain.status, chain.getApi]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Activity"
        title="Transaction evidence"
        body="This page lists extrinsics submitted from this browser. A hash is shown only after the node returned one. Open hashes are checked again on later blocks. Finalized means the extrinsic was in a finalized block and that block contained system.ExtrinsicSuccess. system.ExtrinsicFailed is a failure. A missing hash stays unknown. Indexed history and EVM receipts stay unavailable."
      />
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-medium">This session</h2>
        </div>
        {!txs.ready ? (
          <p className="px-4 py-6 text-sm text-muted">Reading the local transaction record…</p>
        ) : txs.items.length === 0 ? (
          <p className="px-4 py-6 text-sm leading-6 text-muted">
            No extrinsic has been submitted from this browser.
          </p>
        ) : (
          <ul>
            {txs.items.map((item) => (
              <SessionRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </Panel>
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-medium">Build record</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            These calls can be signed from the app. Finalized hashes from the testnet runs are in the demo script. This list is the call catalog, not a claim that no hash exists.
          </p>
          <p className="mt-2 text-xs leading-5 text-faint">
            Live read: {countLine("asset metadata records", chain.assets ? chain.assets.length : null)},{" "}
            {countLine("collections", chain.collectionCount)}, {countLine("pools", chain.poolCount)}. Trading{" "}
            {trading === null ? "has not been read" : trading ? "is enabled" : "is off"}.
          </p>
        </div>
        <ul>
          {BUILD_CALLS.map((row) => (
            <li key={row.id} className="border-b border-line px-4 py-3 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Phase {row.phase}</h3>
                <StatusPill tone="muted">No hash</StatusPill>
              </div>
              <p className="mt-1 font-mono text-xs break-all text-muted">{row.call}</p>
              <p className="mt-1 text-sm leading-6 text-muted">{row.detail}</p>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel className="space-y-3 p-4">
        <h2 className="text-sm font-medium">Sources that are not used</h2>
        <p className="text-sm leading-6 text-muted">
          Indexed history is unavailable. This build does not run an indexer, so a gap is not shown as zero volume or a zero balance.
        </p>
        <p className="text-sm leading-6 text-muted">
          EVM receipts are unavailable. The public EVM endpoint is not a receipt archive, and a log is not treated as success.
        </p>
        <p className="text-sm leading-6 text-muted">
          A hash can be opened in the{" "}
          <a href={NODE_CONSOLE} className="text-blue hover:underline" target="_blank" rel="noreferrer">
            node console
          </a>
          . This app does not append the hash to that URL.
        </p>
      </Panel>
    </div>
  );
}

function SessionRow({ item }: { item: TrackedTx }) {
  const tone =
    item.status === "finalized" ? "ok" : item.status === "failed" ? "bad" : item.status === "ambiguous" ? "warn" : "warn";
  return (
    <li className="border-b border-line px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{item.label}</h3>
        <StatusPill tone={tone}>{txStatusLabel(item.status)}</StatusPill>
      </div>
      {isExtrinsicHash(item.hash) ? (
        <p className="mt-2 font-mono text-xs break-all text-muted">{item.hash}</p>
      ) : (
        <p className="mt-2 text-sm text-muted">No hash was returned for this row.</p>
      )}
      {item.error ? <p className="mt-1 text-sm leading-6 text-warn">{item.error}</p> : null}
    </li>
  );
}

function countLine(label: string, value: number | null): string {
  return value === null ? `${label} unavailable` : `${value} ${label}`;
}
