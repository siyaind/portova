"use client";

import Link from "next/link";
import { ArrowUpRight, Coins, Droplets, Gem, Layers3, Plus, Radio, Sparkles } from "lucide-react";
import { useChain } from "@/components/chain/chain-provider";
import { HoldingsTable } from "@/components/holdings";
import { ProjectSummary } from "@/components/project/project-summary";
import { txStatusLabel, useTxs } from "@/components/tx/tx-tracker";
import { Panel, StatusPill } from "@/components/ui";

const ACTIONS = [
  { href: "/token-launchpad", label: "Launch a token", detail: "Give your idea an identity", icon: Coins },
  { href: "/nft-launchpad", label: "Create a collection", detail: "Make something worth owning", icon: Gem },
  { href: "/liquidity", label: "Explore liquidity", detail: "Bring your assets together", icon: Droplets },
];

export default function OverviewPage() {
  const chain = useChain();
  return <div className="space-y-6">
    <section className="overview-hero rise">
      <div className="page-eyebrow text-[9px] font-semibold tracking-[0.18em] text-violet uppercase">YOUR CREATIVE COMMAND CENTER</div>
      <h1>Your next idea<br /><span>starts here.</span></h1>
      <p>From your first token to a world of collectibles. Bring your assets, your projects, and your possibilities together.</p>
      <Link href="/launch" className="hero-studio-link"><Plus size={14} /> Start a guided launch <ArrowUpRight size={14} /></Link>
    </section>

    <div className="grid gap-3 sm:grid-cols-3">
      {[{ label: "Native assets", value: chain.discovery.assets.complete ? chain.assets?.length ?? null : null, note: "Discover tokens on the network", icon: Coins }, { label: "NFT collections", value: chain.collectionCount, note: "Creative worlds on Portaldot", icon: Gem }, { label: "Liquidity pools", value: chain.poolCount, note: "Native assets, connected", icon: Droplets }].map((stat) => <Panel key={stat.label} className="overview-stat"><div className="overview-stat-top"><span>{stat.label}</span><span className="overview-stat-icon"><stat.icon size={15} /></span></div><strong>{stat.value ?? "—"}</strong><small>{chain.status === "connecting" ? "Reading the network…" : stat.value === null ? "Network read unavailable" : stat.note}</small></Panel>)}
    </div>

    <div className="grid gap-3 sm:grid-cols-3">{ACTIONS.map((action) => <Link key={action.href} href={action.href} className="overview-action"><span><action.icon size={19} /></span><span><strong>{action.label}</strong><small>{action.detail}</small></span><ArrowUpRight size={16} /></Link>)}</div>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
      <Panel><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"><div className="flex items-center gap-2 text-sm font-medium"><Layers3 size={15} className="text-violet" /> Your holdings</div><ChainBadge /></div><HoldingsTable /><div className="flex justify-between gap-3 border-t border-line px-5 py-3 text-[10px] text-faint"><span>Read directly from your connected account</span><Link href="/portfolio" className="inline-flex items-center gap-1 text-violet">Portfolio <ArrowUpRight size={12} /></Link></div></Panel>
      <div className="space-y-5"><SessionPanel /><Panel className="p-5"><div className="flex items-center gap-2 text-xs font-medium"><Radio size={15} className="text-violet" /> Network activity</div><p className="mt-3 text-xs leading-6 text-muted">Your session transactions appear in Activity. Network-wide history will be available when an indexer is connected.</p><Link href="/activity" className="mt-4 inline-flex items-center gap-2 text-[10px] text-violet">View session activity <ArrowUpRight size={13} /></Link></Panel></div>
    </div>
    <ProjectSummary />
    <div className="flex items-center gap-2 px-1 text-[10px] text-faint"><Sparkles size={12} className="text-violet" /><span>This workspace runs on Portaldot V3 Testnet. All balances come from network reads.</span></div>
  </div>;
}

function ChainBadge() {
  const chain = useChain();
  return <StatusPill tone={chain.status === "live" ? "ok" : chain.status === "connecting" ? "warn" : "bad"}>{chain.status === "live" ? `Live · #${chain.blockNumber ?? "—"}` : chain.status === "connecting" ? "Connecting" : "Unavailable"}</StatusPill>;
}

function SessionPanel() {
  const txs = useTxs();
  const open = txs.items.filter((item) => ["signing", "submitted", "included"].includes(item.status));
  return <Panel className="p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-xs font-medium">This session</h2><StatusPill tone={open.length ? "warn" : "muted"}>{!txs.ready ? "Reading" : open.length ? `${open.length} in progress` : "All clear"}</StatusPill></div>{!txs.ready ? <p className="mt-4 text-xs text-muted">Reading your local record…</p> : txs.items.length === 0 ? <div className="py-5 text-center"><div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl border border-line bg-violet/5 text-violet"><Layers3 size={18} strokeWidth={1.5} /></div><p className="text-xs text-ink">A fresh start.</p><p className="mx-auto mt-2 max-w-48 text-[10px] leading-5 text-muted">Your transactions will appear here after you make your first move.</p></div> : <ul className="mt-4 space-y-3">{txs.items.slice(0, 3).map((item) => <li key={item.id} className="flex justify-between gap-3 border-t border-line pt-3 text-[10px]"><span>{item.label}</span><span className="text-faint">{txStatusLabel(item.status)}</span></li>)}</ul>}<Link href="/activity" className="inline-flex items-center gap-2 text-[10px] text-violet">Session details <ArrowUpRight size={13} /></Link></Panel>;
}
