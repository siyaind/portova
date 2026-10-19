"use client";

import Link from "next/link";
import { useChain } from "@/components/chain/chain-provider";
import { HoldingsTable } from "@/components/holdings";
import { ProjectSummary } from "@/components/project/project-summary";
import { txStatusLabel, useTxs } from "@/components/tx/tx-tracker";
import { PageIntro, Panel, StatusPill } from "@/components/ui";

const ACTIONS = [
  { href: "/token-launchpad", label: "Token launchpad" },
  { href: "/nft-launchpad", label: "NFT launchpad" },
  { href: "/swap", label: "Swap" },
  { href: "/liquidity", label: "Liquidity" },
  { href: "/market", label: "Marketplace" },
  { href: "/run", label: "Testnet run" },
  { href: "/studio", label: "Creator studio" },
];

export default function OverviewPage() {
  const chain = useChain();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Overview"
        title="Testnet workspace"
        body="Balances on this page come from a live Portaldot V3 testnet read, or they stay blank. Nothing here is a sample portfolio."
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.8fr)]">
        <Panel>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-sm font-medium">Wallet</h2>
            <ChainBadge />
          </div>
          <HoldingsTable />
        </Panel>
        <div className="space-y-4">
          <Panel className="p-4">
            <h2 className="text-sm font-medium">Quick actions</h2>
            <p className="mt-1 text-xs leading-5 text-faint">
              These open a module. They do not sign or submit.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {ACTIONS.map((action) => (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    className="block rounded-lg border border-line px-3 py-2 text-sm hover:bg-panel-2"
                  >
                    {action.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="p-4">
            <h2 className="text-sm font-medium">On-chain counts</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <Count
                label="Asset metadata records"
                value={chain.assets ? String(chain.assets.length) : null}
              />
              <Count label="NFT collections" value={countText(chain.collectionCount)} />
              <Count label="Liquidity pools" value={countText(chain.poolCount)} />
            </dl>
          </Panel>
        </div>
      </div>
      <ProjectSummary />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="p-4">
          <h2 className="text-sm font-medium">Recent activity</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            History is unavailable. This build does not run an indexer, and the
            public EVM endpoint did not return a reliable receipt archive during
            discovery.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusPill tone="muted">Unavailable</StatusPill>
            <Link href="/activity" className="text-sm text-blue hover:underline">
              Session evidence
            </Link>
          </div>
        </Panel>
        <SessionPanel />
      </div>
    </div>
  );
}

function ChainBadge() {
  const chain = useChain();
  if (chain.status === "connecting") {
    return <StatusPill tone="warn">Connecting</StatusPill>;
  }
  if (chain.status === "unavailable") {
    return <StatusPill tone="bad">Testnet unavailable</StatusPill>;
  }
  return (
    <StatusPill tone="ok">
      {chain.chainName ?? "Live"}
      {chain.blockNumber ? ` · #${chain.blockNumber}` : ""}
    </StatusPill>
  );
}

function SessionPanel() {
  const txs = useTxs();
  const open = txs.items.filter(
    (item) => item.status === "signing" || item.status === "submitted" || item.status === "included",
  );

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">This session</h2>
        <Link href="/activity" className="text-sm text-blue hover:underline">
          Activity
        </Link>
      </div>
      {!txs.ready ? (
        <p className="mt-2 text-sm text-muted">Reading the local transaction record…</p>
      ) : txs.items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-muted">
          No extrinsic has been submitted from this browser.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {txs.items.slice(0, 3).map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 break-words">{item.label}</span>
              <span className="shrink-0 text-xs tracking-wide text-faint uppercase">
                {txStatusLabel(item.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        {!txs.ready ? (
          <StatusPill tone="muted">Reading</StatusPill>
        ) : (
          <StatusPill tone={open.length > 0 ? "warn" : "muted"}>
            {open.length > 0 ? `${open.length} in progress` : "None in progress"}
          </StatusPill>
        )}
      </div>
    </Panel>
  );
}

function Count({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono">{value ?? "Unavailable"}</dd>
    </div>
  );
}

function countText(value: number | null): string | null {
  return value === null ? null : String(value);
}
