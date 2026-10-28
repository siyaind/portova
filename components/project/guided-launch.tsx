"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Coins, Gem, Layers3, ShieldCheck } from "lucide-react";
import { useProject } from "@/components/project/project-provider";
import { useChain } from "@/components/chain/chain-provider";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { useTxs } from "@/components/tx/tx-tracker";
import { CreateTokenForm } from "@/components/token/create-form";
import { CreateCollectionForm } from "@/components/nft/create-form";
import { LiquidityScreen } from "@/components/liquidity/liquidity-screen";
import { LaunchHealth } from "@/components/studio/launch-health";
import { Button, PageIntro, Panel, StatusPill } from "@/components/ui";
import { blankProject } from "@/lib/project";
import type { AccountSnapshot } from "@/lib/chain-read";
import { formatUnits, shortAddress } from "@/lib/format";
import { sameAccount } from "@/lib/withdrawal";
import { TESTNET_GENESIS } from "@/lib/network";

const INPUT = "mt-2 h-12 w-full rounded-xl border border-line bg-bg px-4 text-sm";
export function GuidedLaunch() {
  const stored = useProject(), chain = useChain(), wallet = useSubstrateWallet(), txs = useTxs();
  const project = stored.project, plan = project?.launch;
  const [name, setName] = useState(""), [kind, setKind] = useState<"token" | "nft">("token"), [liquidity, setLiquidity] = useState(false);
  const [step, setStep] = useState(0), [saving, setSaving] = useState(false), [notice, setNotice] = useState<string | null>(null);
  const recovering = useRef(new Set<string>());
  const draftBase = useRef(project ?? blankProject());
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!stored.ready || dirty) return;
    draftBase.current = project ?? blankProject();
    setName(project?.name ?? ""); setKind(plan?.kind ?? "token"); setLiquidity(plan?.liquidity ?? false);
  }, [stored.ready, project, plan?.kind, plan?.liquidity, dirty]);
  const objectId = plan?.kind === "token" ? project?.assetId : project?.collectionId;
  useEffect(() => {
    if (!plan) { setStep(0); return; }
    setStep(!objectId ? 1 : plan.kind === "token" && plan.liquidity ? 2 : 3);
  }, [project?.id, plan?.kind, plan?.liquidity, objectId]);
  // A finalized receipt can complete linking after a reload or after a late wallet result.
  useEffect(() => {
    if (!project?.id) return;
    for (const row of txs.items) {
      if (row.status !== "finalized" || row.genesisHash !== TESTNET_GENESIS || row.projectId !== project.id || !row.projectField || !row.objectId || !row.account || project[row.projectField] || recovering.current.has(row.id)) continue;
      recovering.current.add(row.id);
      void stored.attach(project.id, row.projectField, row.objectId, row.account).then(error => { if (error) setNotice(error); });
    }
  }, [project, txs.items, stored.attach]);
  async function savePlan(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setNotice(null);
    const error = await stored.save({ ...draftBase.current, name, proceeds: draftBase.current.proceeds || wallet.selected?.address || "", launch: { kind, liquidity: kind === "token" && liquidity } });
    if (!error) setDirty(false);
    setSaving(false); if (error) setNotice(error); else setStep((kind === "token" ? project?.assetId : project?.collectionId) ? kind === "token" && liquidity ? 2 : 3 : 1);
  }
  const wrongAccount = !!(project?.proceeds && wallet.selected && !sameAccount(project.proceeds, wallet.selected.address));
  const matchingPool = chain.pools?.find(row => [row.asset1, row.asset2].some(side => side.kind === "native") && [row.asset1, row.asset2].some(side => side.kind === "asset" && side.id === project?.assetId));
  const stages = ["Your project", plan?.kind === "nft" ? "Collection & first mint" : "Your token", "Optional liquidity", "Launch health"];
  return <div className="space-y-6">
    <PageIntro eyebrow="Guided project launch" title="One idea. A clear next step." body="Choose your launch, review each cost, and keep your onchain objects together. Progress stays in this browser. Every transaction still needs its own wallet approval." />
    <nav aria-label="Launch progress" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stages.map((label, index) => <button key={label} type="button" aria-current={step === index ? "step" : undefined} disabled={index === 1 ? !plan : index === 2 ? !objectId || plan?.kind !== "token" || !plan.liquidity : index === 3 ? !objectId : false} onClick={() => { setStep(index); setNotice(null); }} className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-xs disabled:opacity-35 ${step === index ? "border-violet/60 bg-violet/10 text-ink" : "border-line bg-panel text-muted"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${step === index ? "bg-violet text-violet-ink" : "bg-panel-2"}`}>{index < step ? <Check size={13} /> : index + 1}</span>{label}</button>)}</nav>
    {stored.storageError && <p role="alert" className="rounded-xl border border-warn/30 p-4 text-sm text-warn">{stored.storageError}</p>}
    {notice && <p role="status" className="text-sm leading-6 text-warn">{notice}</p>}{dirty && project?.revision !== draftBase.current.revision && <Button onClick={() => { setDirty(false); setNotice(null); setStep(0); }}>Discard edits and load latest saved project</Button>}
    {!stored.ready ? <Panel className="p-6 text-sm text-muted">Reading your saved project…</Panel> : step === 0 ? <form onSubmit={savePlan} className="space-y-5">
      <Panel className="space-y-6 p-5 sm:p-7"><div className="flex items-center gap-3 text-violet"><Layers3 size={20} /><h2 className="text-xl font-semibold text-ink">Make it yours.</h2></div><label className="block text-sm">Project name<input className={INPUT} value={name} onChange={event => { setDirty(true); setName(event.target.value); }} maxLength={48} required placeholder="Your next chapter" /></label><fieldset><legend className="mb-3 text-sm">What are you creating?</legend><div className="grid gap-3 sm:grid-cols-2">{([{ value: "token", title: "A creator token", detail: "Create an asset, set its supply, and optionally open a tPOT pool.", Icon: Coins }, { value: "nft", title: "An NFT collection", detail: "Create a collection, add metadata, and mint its first item in two signatures.", Icon: Gem }] as const).map(option => <label key={option.value} className={`cursor-pointer rounded-2xl border p-5 ${kind === option.value ? "border-violet bg-violet/5" : "border-line"}`}><span className="flex items-center justify-between"><option.Icon size={22} className="text-violet" /><input type="radio" name="launch-kind" value={option.value} checked={kind === option.value} onChange={() => { setDirty(true); setKind(option.value); }} /></span><strong className="mt-4 block text-sm">{option.title}</strong><span className="mt-2 block text-xs leading-6 text-muted">{option.detail}</span></label>)}</div></fieldset>{kind === "token" && <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={liquidity} onChange={event => { setDirty(true); setLiquidity(event.target.checked); }} /><span>Include optional liquidity setup<span className="mt-1 block text-xs leading-6 text-muted">Pool creation and a deposit are separate signatures. Setup fees, token amounts and tPOT are reviewed at that step.</span></span></label>}{project && <p className="text-xs leading-6 text-muted">This continues your browser&apos;s project “{project.name}”. Existing object links stay attached. To start a separate project, manage this record in <Link href="/studio" className="text-violet underline">Studio</Link>.</p>}<Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : plan ? "Save launch plan" : "Save & continue"}<ArrowRight size={15} /></Button><p className="text-xs text-faint">Saving the plan does not connect a wallet, create an asset or move funds.</p></Panel>
    </form> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel/60 px-5 py-4"><div><p className="text-xs text-faint">YOUR PROJECT</p><p className="mt-1 font-medium">{project?.name}</p></div><Link href="/studio" className="text-xs text-violet">Manage links in Studio ↗</Link></div>
      {step < 3 && <FundingReadiness />}
      {wrongAccount ? <Panel className="space-y-3 p-6"><p role="alert" className="text-sm text-warn">This project references {shortAddress(project!.proceeds)}. Select that account or explicitly change the linked account in Studio before continuing.</p><Button onClick={() => void wallet.connect()}>Refresh wallet accounts</Button></Panel> : step === 1 && project?.id ? <><Panel className="p-5 text-xs leading-6 text-muted"><ShieldCheck size={18} className="mb-3 text-violet" />Review the fee, reserved deposits, recipient and permissions below before approving. Successful finalized objects are attached to this project automatically. A pool or future action has its own cost review.</Panel>{objectId ? <Panel className="space-y-4 p-5"><h2 className="text-xl font-semibold">Your {plan?.kind === "nft" ? "collection" : "token"} is already linked.</h2><p className="text-sm text-muted">Object #{objectId}. Review it in Studio before replacing this project link.</p><Button variant="primary" onClick={() => setStep(plan?.kind === "token" && plan.liquidity ? 2 : 3)}>Continue <ArrowRight size={14} /></Button></Panel> : plan?.kind === "nft" ? <CreateCollectionForm projectId={project.id} /> : <CreateTokenForm projectId={project.id} initialName={project.name} />}</> : step === 2 && project?.id ? <div className="space-y-5"><Panel className="space-y-4 p-5"><h2 className="text-xl font-semibold">Give your token room to move.</h2><p className="text-sm leading-7 text-muted">Create or link its tPOT pool, then choose the amounts to deposit. This step is optional; a pool without a deposit has no usable liquidity.</p>{project.poolLpToken ? <StatusPill tone="ok">Linked LP token #{project.poolLpToken}</StatusPill> : matchingPool ? <Button onClick={() => void stored.save({ ...project, poolLpToken: matchingPool.lpToken }).then(error => setNotice(error))}>Link existing pool #{matchingPool.lpToken}</Button> : null}<div className="flex flex-wrap gap-3"><Button variant="primary" onClick={() => setStep(3)}>Review launch health <ArrowRight size={14} /></Button><Button onClick={() => void stored.save({ ...project, launch: { kind: "token", liquidity: false } }).then(error => setNotice(error))}>Skip liquidity for now</Button></div></Panel>{chain.assets?.some(row => row.id === project.assetId) ? <LiquidityScreen projectId={project.id} assetId={project.assetId} /> : <Panel className="space-y-3 p-5"><p className="text-sm text-muted">Reading metadata for asset #{project.assetId} before building a deposit.</p><Button disabled={chain.discovery.assets.loading || chain.status !== "live"} onClick={() => void chain.refreshAssets().catch(() => undefined)}>Refresh token discovery</Button></Panel>}</div> : step === 3 ? <><Panel className="space-y-4 p-5"><h2 className="text-xl font-semibold">Your next move, with the facts.</h2><p className="text-sm leading-7 text-muted">The view below verifies the objects currently linked to your project. A saved link is not a successful transaction or a guarantee that a launch is ready. Review missing data, ownership and liquidity before continuing.</p><div className="flex flex-wrap gap-3"><Link href="/studio" className="rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-violet-ink">Open Creator Studio ↗</Link><Link href="/activity" className="rounded-xl border border-line px-4 py-3 text-sm">Inspect receipts ↗</Link></div></Panel><LaunchHealth /></> : null}
    </>}
  </div>;
}

function FundingReadiness() {
  const chain = useChain(), wallet = useSubstrateWallet(), txs = useTxs();
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null), [reading, setReading] = useState(false), [revision, setRevision] = useState(0);
  const account = wallet.selected?.address;
  const settled = txs.items.filter(row => sameAccount(row.account, account) && ["finalized", "failed"].includes(row.status)).map(row => `${row.id}:${row.status}`).join("|");
  useEffect(() => {
    let cancelled = false; setSnapshot(null);
    if (!account || chain.status !== "live") { setReading(false); return; }
    setReading(true);
    void chain.readAccount(account).then(value => { if (!cancelled) setSnapshot(value); }).finally(() => { if (!cancelled) setReading(false); });
    return () => { cancelled = true; };
  }, [account, chain.status, chain.readAccount, revision, settled]);
  return <Panel className="grid gap-5 p-5 sm:grid-cols-3"><div><p className="text-xs text-faint">NETWORK</p><p className="mt-2 text-sm">Portaldot V3 Testnet</p><StatusPill tone={chain.status === "live" ? "ok" : "warn"}>{chain.status === "live" ? "Ready" : chain.status === "connecting" ? "Connecting" : "Unavailable"}</StatusPill></div><div><p className="text-xs text-faint">SIGNING ACCOUNT</p><p className="mt-2 break-all font-mono text-xs">{account ? shortAddress(account, 8, 8) : "Connect a Substrate wallet when you are ready."}</p><Button className="mt-3" disabled={wallet.status === "connecting"} onClick={() => void wallet.connect()}>{account ? "Refresh accounts" : "Connect Substrate wallet"}</Button>{wallet.error && <p role="alert" className="mt-2 text-xs text-warn">{wallet.error}</p>}</div><div><p className="text-xs text-faint">KEEP-ALIVE SPENDABLE</p><p className="mt-2 font-mono text-sm">{reading ? "Reading…" : snapshot?.spendable !== null && snapshot?.spendable !== undefined ? `${formatUnits(snapshot.spendable, 14)} tPOT` : "Unavailable"}</p>{snapshot?.blockNumber && <p className="mt-1 text-xs text-faint">Finalized block {snapshot.blockNumber}</p>}{snapshot?.error && <p className="mt-2 text-xs text-warn">{snapshot.error}</p>}<button type="button" className="mt-2 text-xs text-violet underline disabled:opacity-40" disabled={!account || reading || chain.status !== "live"} onClick={() => setRevision(value => value + 1)}>Refresh balance</button><p className="mt-3 text-xs leading-6 text-muted">Need testnet tPOT? Follow the <a className="text-violet underline" href="https://dorahacks.io/hackathon/portaldot-hacker-house-2026/detail" target="_blank" rel="noreferrer">official participant funding instructions</a>. Fees and deposits are reviewed before each signature.</p></div></Panel>;
}
