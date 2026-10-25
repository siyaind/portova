"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { readAccount, readAssetPage, type AccountSnapshot, type AssetRow } from "@/lib/chain-read";
import { readCollectionPage, type CollectionSummary } from "@/lib/nfts";
import { readPoolPage, type PoolView } from "@/lib/pools";
import { emptyDiscovery, type DiscoveryState } from "@/lib/discovery-state";
import { errorText } from "@/lib/format";
import { SUBSTRATE_WS, TESTNET_GENESIS } from "@/lib/network";

export type ChainStatus = "connecting" | "live" | "unavailable";
type Kind = "assets" | "collections" | "pools";
type ChainValue = {
  status: ChainStatus; chainName: string | null; blockNumber: string | null;
  assets: AssetRow[] | null; collections: CollectionSummary[] | null; pools: PoolView[] | null;
  collectionCount: number | null; poolCount: number | null;
  discovery: Record<Kind, DiscoveryState>; error: string | null;
  readAccount: (address: string, onNative?: (snapshot: AccountSnapshot) => void) => Promise<AccountSnapshot>;
  refreshAssets(): Promise<void>; refreshCollections(): Promise<void>; refreshPools(): Promise<void>;
  getApi(): ApiPromise | null;
};
const ChainContext = createContext<ChainValue | null>(null);
export function ChainProvider({ children }: { children: React.ReactNode }) {
  const apiRef = useRef<ApiPromise | null>(null), alive = useRef(true);
  const scans = useRef<Record<Kind, number>>({ assets: 0, collections: 0, pools: 0 });
  const [status, setStatus] = useState<ChainStatus>("connecting"), [error, setError] = useState<string | null>(null);
  const [chainName, setChainName] = useState<string | null>(null), [blockNumber, setBlockNumber] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetRow[] | null>(null), [collections, setCollections] = useState<CollectionSummary[] | null>(null), [pools, setPools] = useState<PoolView[] | null>(null);
  const [discovery, setDiscovery] = useState<Record<Kind, DiscoveryState>>({ assets: emptyDiscovery(), collections: emptyDiscovery(), pools: emptyDiscovery() });
  const latest = useRef({ assets, discovery }); latest.current = { assets, discovery };

  const scan = useCallback(async (kind: Kind) => {
    const api = apiRef.current; if (!api?.isConnected) return;
    const ticket = ++scans.current[kind];
    const current = () => alive.current && apiRef.current === api && api.isConnected && scans.current[kind] === ticket;
    setDiscovery(old => ({ ...old, [kind]: { ...emptyDiscovery(), loading: true } }));
    let cursor: string | null = null, blockHash: string | undefined;
    let rows: Array<AssetRow | CollectionSummary | PoolView> = [];
    try {
      do {
        const page: { rows: Array<AssetRow | CollectionSummary | PoolView>; blockHash: string; nextCursor: string | null; complete: boolean } = kind === "assets" ? await readAssetPage(api, cursor, blockHash) : kind === "collections" ? await readCollectionPage(api, { cursor, blockHash }) : await readPoolPage(api, cursor, blockHash);
        if (!current()) return;
        rows = [...rows, ...page.rows]; cursor = page.nextCursor; blockHash = page.blockHash;
        if (kind === "assets") setAssets(rows as AssetRow[]);
        else if (kind === "collections") setCollections(rows as CollectionSummary[]);
        else setPools(rows as PoolView[]);
        setDiscovery(old => ({ ...old, [kind]: { loading: !page.complete, complete: page.complete, scanned: rows.length, blockHash, error: null } }));
      } while (cursor);
    } catch (cause) {
      if (current()) setDiscovery(old => ({ ...old, [kind]: { loading: false, complete: false, scanned: rows.length, blockHash, error: errorText(cause) } }));
      throw cause;
    }
  }, []);
  const refreshAssets = useCallback(() => scan("assets"), [scan]);
  const refreshCollections = useCallback(() => scan("collections"), [scan]);
  const refreshPools = useCallback(() => scan("pools"), [scan]);
  useEffect(() => {
    alive.current = true;
    let cancelled = false, generation = 0, unsubscribe: (() => void) | undefined;
    async function ready(api: ApiPromise) {
      const ticket = ++generation;
      try {
        if (api.genesisHash.toHex() !== TESTNET_GENESIS || api.runtimeVersion.specName.toString() !== "portaldot-v3") throw Error("This node does not match the verified Portaldot V3 testnet. Signing is disabled.");
        const [name, header] = await Promise.all([api.rpc.system.chain(), api.rpc.chain.getHeader()]);
        if (cancelled || ticket !== generation) return;
        setChainName(name.toString()); setBlockNumber(header.number.toString());
        unsubscribe?.();
        unsubscribe = await api.rpc.chain.subscribeNewHeads(head => { if (!cancelled) setBlockNumber(head.number.toString()); });
        if (cancelled || ticket !== generation) { unsubscribe?.(); return; }
        // Discovery failures do not disable independent account reads or signing.
        setStatus("live"); setError(null);
        void Promise.allSettled([refreshAssets(), refreshCollections(), refreshPools()]);
      } catch (cause) { if (!cancelled && ticket === generation) { setStatus("unavailable"); setError(errorText(cause)); } }
    }
    void (async () => {
      try {
        const { ApiPromise, WsProvider } = await import("@polkadot/api");
        const api = await ApiPromise.create({ provider: new WsProvider(SUBSTRATE_WS, 2_500) });
        if (cancelled) { await api.disconnect(); return; }
        apiRef.current = api;
        api.on("disconnected", () => {
          if (cancelled) return; generation++;
          for (const kind of ["assets", "collections", "pools"] as const) scans.current[kind]++;
          setStatus("unavailable"); setError("The testnet connection dropped. The client will try to reconnect.");
          setDiscovery(old => Object.fromEntries(Object.entries(old).map(([kind, state]) => [kind, { ...state, loading: false, complete: false, error: "Connection dropped; refresh after reconnect." }])) as Record<Kind, DiscoveryState>);
        });
        api.on("connected", () => { if (!cancelled) { setStatus("connecting"); void ready(api); } });
        await ready(api);
      } catch (cause) { if (!cancelled) { setStatus("unavailable"); setError(errorText(cause)); } }
    })();
    return () => { cancelled = true; generation++; alive.current = false; unsubscribe?.(); const api = apiRef.current; apiRef.current = null; void api?.disconnect(); };
  }, [refreshAssets, refreshCollections, refreshPools]);
  const getApi = useCallback(() => apiRef.current, []);
  const readAccountFor = useCallback(async (address: string, onNative?: (snapshot: AccountSnapshot) => void): Promise<AccountSnapshot> => {
    const api = apiRef.current;
    if (!api?.isConnected) return { free: null, spendable: null, holdings: [], error: "The testnet connection is not available." };
    try { return await readAccount(api, address, latest.current.assets ?? [], onNative, latest.current.discovery.assets.complete); }
    catch (cause) { return { free: null, spendable: null, holdings: [], error: errorText(cause) }; }
  }, []);
  const value = useMemo<ChainValue>(() => ({ status, chainName, blockNumber, assets, collections, pools, discovery, error,
    collectionCount: discovery.collections.complete ? collections?.length ?? 0 : null,
    poolCount: discovery.pools.complete ? pools?.length ?? 0 : null,
    refreshAssets, refreshCollections, refreshPools, getApi, readAccount: readAccountFor }), [status, chainName, blockNumber, assets, collections, pools, discovery, error, refreshAssets, refreshCollections, refreshPools, getApi, readAccountFor]);
  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}
export function useChain(): ChainValue { const value = useContext(ChainContext); if (!value) throw Error("useChain must be used inside ChainProvider"); return value; }
