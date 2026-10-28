"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, CheckCircle2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useChain } from "@/components/chain/chain-provider";
import { useProject } from "@/components/project/project-provider";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { useTxs } from "@/components/tx/tx-tracker";
import { Button, Panel, StatusPill } from "@/components/ui";
import { readHolderPage, readLaunchHealth } from "@/lib/launch-health-read";
import { constantProductScenario, outsideIssuerSupply, proRataReserve, shareBasisPoints } from "@/lib/launch-health";
import { assetDecimals, assetLabel } from "@/lib/pools";
import { formatUnits, parseDecimalToPlanck, shortAddress } from "@/lib/format";
import { sameAccount } from "@/lib/withdrawal";
import { receiptExplorerUrl } from "@/lib/explorer";
import { TESTNET_GENESIS } from "@/lib/network";
import type { CreatorProject } from "@/lib/project";

type Snapshot = Awaited<ReturnType<typeof readLaunchHealth>>;
const percent = (bps: number | null) => bps === null ? "Unavailable" : `${(bps / 100).toFixed(2)}%`;
export function LaunchHealth({ project: externalProject, publicView = false }: { project?: CreatorProject; publicView?: boolean } = {}) {
  const chain = useChain(), stored = useProject(), wallet = useSubstrateWallet(), txs = useTxs();
  const project = externalProject ?? stored.project;
  const account = project?.proceeds || (!publicView ? wallet.selected?.address : null) || null;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(false), [holderLoading, setHolderLoading] = useState(false);
  const [scenario, setScenario] = useState("0.1");
  const generation = useRef(0);
  const projectKey = JSON.stringify(project);
  useEffect(() => {
    const api = chain.getApi(), request = ++generation.current;
    setSnapshot(null); setError(null); setHolderLoading(false); setLoading(false);
    if (!api || chain.status !== "live" || !project) { if (chain.status === "unavailable") setError(chain.error ?? "The testnet connection is unavailable."); return; }
    setLoading(true);
    const pool = chain.pools?.find(row => row.lpToken === project.poolLpToken) ?? null;
    void readLaunchHealth(api, project, pool, account).then(value => { if (generation.current === request) setSnapshot(value); }).catch(cause => { if (generation.current === request) setError(cause instanceof Error ? cause.message : "Health snapshot unavailable."); }).finally(() => { if (generation.current === request) setLoading(false); });
    return () => { generation.current++; };
    // A stable project/snapshot avoids re-reading all holders on every new head.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey, account, chain.status, chain.getApi, revision, chain.pools]);
  async function loadHolders() {
    const api = chain.getApi(); if (!api || !snapshot?.holders?.nextCursor || !project || holderLoading) return;
    const request = generation.current; setHolderLoading(true);
    try {
      const page = await readHolderPage(api, project.assetId, snapshot.blockHash, snapshot.holders.nextCursor);
      if (request === generation.current) setSnapshot(current => current?.holders ? { ...current, holders: { ...page, scanned: current.holders.scanned + page.scanned, rows: [...current.holders.rows, ...page.rows] } } : current);
    } catch { if (request === generation.current) setError("The next holder page could not be read. Coverage remains partial."); }
    finally { if (request === generation.current) setHolderLoading(false); }
  }
  const asset = snapshot?.asset, collection = snapshot?.collection, pool = snapshot?.pool;
  const symbols = new Map((chain.assets ?? []).map(row => [row.id, row.symbol]));
  const decimals = new Map((chain.assets ?? []).flatMap(row => row.decimals === null ? [] : [[row.id, row.decimals] as const]));
  const nativeFirst = pool?.asset1.kind === "native", nativeSecond = pool?.asset2.kind === "native";
  const reserveIn = nativeFirst ? pool?.reserve1 : nativeSecond ? pool?.reserve2 : null;
  const reserveOut = nativeFirst ? pool?.reserve2 : nativeSecond ? pool?.reserve1 : null;
  const outputAsset = nativeFirst ? pool?.asset2 : nativeSecond ? pool?.asset1 : null;
  const input = parseDecimalToPlanck(scenario, 14);
  const model = constantProductScenario(reserveIn ?? null, reserveOut ?? null, input?.toString() ?? null);
  const warnings: string[] = [];
  if (snapshot && project?.assetId && !asset?.found) warnings.push("The linked token was not verified at this snapshot. Check its ID and connection.");
  if (snapshot && project?.collectionId && !collection?.found) warnings.push("The linked collection was not verified. Check its ID before planning a mint.");
  if (asset?.found && (asset.frozen === true || (asset.status !== null && asset.status !== "Live"))) warnings.push("The asset is frozen or is not in its Live state. Inspect its runtime status and authorities before sending an operation.");
  if (asset?.found && account && !sameAccount(asset.owner, account)) warnings.push("The linked account is not the token owner. Review the displayed management roles before an administrative action.");
  if (project?.poolLpToken && snapshot && !pool) warnings.push("The linked pool could not be verified. Check the LP token ID and refresh.");
  if (pool && [pool.reserve1, pool.reserve2].some(value => value === "0" || value === null)) warnings.push("This pool has empty or unavailable reserves. Add liquidity before expecting an executable swap.");
  if (pool && project?.assetId && ![pool.asset1, pool.asset2].some(value => value.kind === "asset" && value.id === project.assetId)) warnings.push("The linked pool does not contain the linked token. Correct the project links.");
  if (model && model.impactBps >= 500) warnings.push("The scenario is at least 5% below the reserve-ratio price in this model. Review the executable swap quote before signing.");
  const receipts = txs.items.filter(row => row.status === "finalized" && row.genesisHash === TESTNET_GENESIS && sameAccount(row.account, account)).slice(0, 6);
  const outside = asset ? outsideIssuerSupply(asset.supply, snapshot?.issuerBalance ?? null) : null;
  const amount = (raw: string | null | undefined, places: number | null | undefined) => raw !== null && raw !== undefined && places !== null && places !== undefined ? formatUnits(raw, places) : "Unavailable";
  return <section aria-label="Creator Launch Health" className="space-y-4">
    <Panel className="overflow-hidden p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs uppercase tracking-widest text-violet"><ShieldCheck size={14} /> Creator Launch Health</p><h2 className="mt-3 text-2xl font-semibold tracking-tight">Your launch, in focus.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Ownership, supply, holders and liquidity from one finalized snapshot. Read the snapshot time before relying on these values.</p></div><Button disabled={loading || chain.status !== "live" || !project} onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} />{loading ? "Reading…" : "Refresh health"}</Button></div>
    {!project ? <p className="mt-5 text-sm text-muted">Save a project below to see its launch health.</p> : <div className="mt-5 space-y-3"><StatusPill tone={loading ? "warn" : snapshot ? "ok" : "muted"}>{loading ? "Reading finalized state" : snapshot ? `Finalized block ${snapshot.blockNumber}` : "Waiting for the network"}</StatusPill>{snapshot && <p className="text-xs text-faint">Read {new Date(snapshot.loadedAt).toLocaleString()} · Refresh to read newer state.</p>}{account && <p className="font-mono text-xs break-all text-muted">Reference account {account}</p>}</div>}
    {error && <p role="alert" className="mt-4 text-sm text-warn">{error}</p>}{snapshot?.errors.map(message => <p key={message} className="mt-3 text-xs text-warn">{message}</p>)}
    {snapshot && <div className="mt-5 space-y-2">{warnings.length ? warnings.map(warning => <p key={warning} className="flex items-start gap-2 rounded-lg border border-warn/20 bg-warn/5 p-3 text-xs leading-6 text-warn"><TriangleAlert size={14} className="mt-1 shrink-0" />{warning}</p>) : <p className="flex items-center gap-2 text-xs text-ok"><CheckCircle2 size={14} /> No attention flags in the available checks. Missing data and permissions are shown below.</p>}</div>}</Panel>
    {snapshot && <div className="grid items-start gap-4 xl:grid-cols-2"><Panel className="space-y-4 p-5"><h3 className="text-sm font-medium">Token authority & supply</h3>{asset?.found ? <><Metric name="Token" value={`${asset.name} · ${asset.symbol} #${asset.id}`} /><Metric name="Total on-chain supply" value={amount(asset.supply, asset.decimals)} /><Metric name="Held outside issuer account" value={amount(outside, asset.decimals)} /><p className="text-xs leading-6 text-faint">Outside-issuer balance is total supply minus the issuer&apos;s balance. Circulating supply needs a defined policy for treasury, locked and excluded accounts; it is not inferred here.</p><Metric name="Owner" value={asset.owner ?? "Unavailable"} /><Metric name="Issuer / mint authority" value={asset.issuer ?? "Unavailable"} /><p className="text-xs leading-6 text-muted">{asset.issuer ? "Mint authority is assigned. Further minting depends on permissions and asset state. The Assets record has no fixed supply cap, so a remaining mintable percentage is unavailable." : "Issuer authority could not be read. Minting status is unverified."}</p><Link href={`/token/${asset.id}`} className="inline-flex items-center gap-1 text-xs text-violet">Inspect token roles <ArrowUpRight size={12} /></Link></> : <p className="text-xs text-muted">Link a verified token to inspect its supply and roles.</p>}{collection?.found && <div className="border-t border-line pt-4"><Metric name={`Collection #${collection.id} owner`} value={collection.owner ?? "Unavailable"} /><p className="mt-2 text-xs text-muted">Mint access: {collection.mintType ?? "Unavailable"} · Supply cap: {collection.maxSupply === "None" ? "Not set" : collection.maxSupply ?? "Unavailable"}</p></div>}</Panel>
    <Panel className="space-y-4 p-5"><h3 className="text-sm font-medium">Liquidity & your LP share</h3>{pool ? <>{[pool.asset1, pool.asset2].map((item, index) => <Metric key={index} name={`${assetLabel(item, symbols)} reserves`} value={amount(index === 0 ? pool.reserve1 : pool.reserve2, assetDecimals(item, decimals))} />)}<Metric name="Reference-account LP ownership" value={percent(shareBasisPoints(snapshot.lpBalance, snapshot.lpSupply))} />{[pool.asset1, pool.asset2].map((item, index) => <Metric key={index} name={`${assetLabel(item, symbols)} pro-rata share`} value={amount(proRataReserve(index === 0 ? pool.reserve1 : pool.reserve2, snapshot.lpBalance, snapshot.lpSupply), assetDecimals(item, decimals))} />)}<p className="text-xs text-faint">Pro-rata shares exclude withdrawal fees and runtime rounding constraints.</p>{outputAsset && <div className="space-y-3 border-t border-line pt-4"><label className="block text-xs text-muted">Swap scenario (tPOT)<input className="mt-2 h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-sm" inputMode="decimal" value={scenario} onChange={event => setScenario(event.target.value)} /></label><Metric name="Model price impact" value={model ? percent(model.impactBps) : "Unavailable"} /><Metric name={`Model ${assetLabel(outputAsset, symbols)} received`} value={model ? amount(model.output, assetDecimals(outputAsset, decimals)) : "Unavailable"} /><p className="text-xs leading-6 text-faint">Constant-product estimate before fees. This is a scenario, not a runtime quote or guaranteed execution result.</p><Link href="/swap" className="text-xs text-violet">Review an executable swap quote ↗</Link></div>}</> : <p className="text-xs leading-6 text-muted">Link a pool with verified reserves to inspect liquidity and scenario impact.</p>}</Panel>
    <Panel className="space-y-4 p-5"><h3 className="text-sm font-medium">Who holds the token?</h3>{snapshot.holders ? <><p className="text-xs text-muted">{snapshot.holders.scanned} account entries checked · {snapshot.holders.complete ? "Complete at this snapshot" : "Partial — load more holders"}</p><ul className="space-y-3">{snapshot.holders.rows.map(holder => <li key={holder.address} className="flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-xs"><span title={holder.address} className="font-mono">{shortAddress(holder.address)}</span><span>{amount(holder.balance, asset?.decimals)} {asset?.symbol} · {percent(shareBasisPoints(holder.balance, asset?.supply ?? null))}</span></li>)}</ul>{snapshot.holders.nextCursor && <Button disabled={holderLoading} onClick={() => void loadHolders()}>{holderLoading ? "Reading…" : "Load more holders"}</Button>}</> : <p className="text-xs text-muted">Holder data is unavailable. Missing data is not an empty holder set.</p>}</Panel>
    {!publicView && <Panel className="space-y-4 p-5"><h3 className="flex items-center gap-2 text-sm font-medium"><Activity size={14} /> Recent confirmed account activity</h3><p className="text-xs leading-6 text-faint">Finalized receipts saved in this browser for the reference account. These can include actions outside this project and do not form a complete account or project history.</p>{receipts.length ? <ul className="space-y-3">{receipts.map(row => <li key={row.id} className="border-t border-line pt-3 text-xs"><p>{row.label}</p>{row.hash && <a href={receiptExplorerUrl(row.hash) ?? "#"} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-violet">Verified receipt ↗</a>}</li>)}</ul> : <p className="text-xs text-muted">No matching finalized receipt is saved in this browser.</p>}<Link href="/activity" className="inline-block text-xs text-violet">Open receipts & recovery</Link></Panel>}</div>}
  </section>;
}
function Metric({ name, value }: { name: string; value: string }) { return <div className="space-y-1"><p className="text-xs text-faint">{name}</p><p className="font-mono text-sm break-all text-ink">{value}</p></div>; }
