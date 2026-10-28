"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ApiPromise } from "@polkadot/api";
import { useChain } from "@/components/chain/chain-provider";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { useTxs } from "@/components/tx/tx-tracker";
import { Button, Panel } from "@/components/ui";
import { mapBounded } from "@/lib/async-map";
import { readLpBalance, readReserves, assetDecimals, assetLabel, poolLabel, type PoolView } from "@/lib/pools";
import { proRataReserve, shareBasisPoints } from "@/lib/launch-health";
import { formatUnits } from "@/lib/format";
import { sameAccount } from "@/lib/withdrawal";

type Position = { pool: PoolView; balance: string; supply: string | null; reserves: [string | null, string | null] };
export function LpHoldings() {
  const chain = useChain(), wallet = useSubstrateWallet(), txs = useTxs();
  const address = wallet.selected?.address;
  const [rows, setRows] = useState<Position[]>([]), [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState(""), [loading, setLoading] = useState(false), [revision, setRevision] = useState(0);
  const settled = txs.items.filter(row => row.status === "finalized" && sameAccount(row.account, address)).map(row => row.id).join("|");
  useEffect(() => {
    let cancelled = false; setRows([]); setSnapshot(""); setError(null);
    const api = chain.getApi();
    if (!api || !address || chain.status !== "live" || !chain.pools) { setLoading(false); return; }
    setLoading(true);
    void (async () => {
      const hash = await api.rpc.chain.getFinalizedHead(), at = await api.at(hash) as unknown as ApiPromise;
      const header = await api.rpc.chain.getHeader(hash);
      const positions = await mapBounded(chain.pools!, 4, async pool => {
        const balance = await readLpBalance(at, pool.lpToken, address);
        if (balance === null) throw Error("An LP balance could not be read. Refresh to retry.");
        if (BigInt(balance) === 0n) return null;
        const [info, reserves] = await Promise.all([at.query.poolAssets.asset(pool.lpToken), readReserves(at, pool.asset1, pool.asset2)]);
        const data = info.toJSON() as { supply?: string | number } | null;
        const raw = String(data?.supply ?? ""), supply = /^(?:\d+|0x[0-9a-fA-F]+)$/.test(raw) ? BigInt(raw).toString() : null;
        return { pool, balance, supply, reserves };
      });
      if (!cancelled) { setRows(positions.filter((row): row is Position => row !== null)); setSnapshot(`Finalized block ${header.number.toString()} · Read ${new Date().toLocaleString()}`); }
    })().catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "LP balances are unavailable."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address, chain.status, chain.getApi, chain.pools, revision, settled]);
  const symbols = new Map((chain.assets ?? []).map(row => [row.id, row.symbol]));
  const decimals = new Map((chain.assets ?? []).flatMap(row => row.decimals === null ? [] : [[row.id, row.decimals] as const]));
  return <Panel className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Your liquidity positions</h2><Button disabled={loading || !address || chain.status !== "live"} onClick={() => setRevision(n => n + 1)}>Refresh LP balances</Button></div>
    <p className="text-xs leading-6 text-muted">{!address ? "Connect a Substrate wallet to read your LP tokens." : loading ? "Reading finalized LP balances…" : snapshot || "Waiting for the network."} {!chain.discovery.pools.complete && "Pool discovery is partial; undiscovered positions may be missing."}</p>
    {error && <p role="alert" className="text-sm text-warn">{error}</p>}
    {address && snapshot && !rows.length && <p className="text-sm text-muted">No positive LP balances in the discovered pools at this snapshot.</p>}
    {rows.map(({ pool, balance, supply, reserves }) => { const bps = shareBasisPoints(balance, supply); return <div key={pool.lpToken} className="space-y-2 rounded-xl border border-line p-4"><h3 className="font-medium">{poolLabel(pool, symbols)} · LP #{pool.lpToken}</h3><p className="text-sm">LP balance: {pool.lpDecimals === null ? `${balance} base units` : formatUnits(balance, pool.lpDecimals)} · Pool share: {bps === null ? "Unavailable" : `${(bps / 100).toFixed(2)}%`}</p>{[pool.asset1, pool.asset2].map((asset, index) => { const raw = proRataReserve(reserves[index], balance, supply), places = assetDecimals(asset, decimals); return <p key={index} className="text-xs text-muted">{assetLabel(asset, symbols)} pro-rata reserves: {raw !== null && places !== null ? formatUnits(raw, places) : "Unavailable"}</p>; })}<Link className="inline-block text-sm text-violet" href={`/liquidity?pool=${pool.lpToken}`}>Manage this position ↗</Link></div>; })}
    <p className="text-xs leading-6 text-faint">Reserve shares exclude withdrawal fees and rounding. LP token quantities are separate from created-token balances.</p>
  </Panel>;
}
