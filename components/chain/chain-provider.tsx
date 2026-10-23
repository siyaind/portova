"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ApiPromise } from "@polkadot/api";
import {
  countEntries,
  readAccount,
  readAssets,
  type AccountSnapshot,
  type AssetRow,
} from "@/lib/chain-read";
import { readCollectionList, type CollectionSummary } from "@/lib/nfts";
import { readPools, type PoolView } from "@/lib/pools";
import { applyChainSnapshot } from "@/lib/chain-snapshot";
import { errorText } from "@/lib/format";
import { SUBSTRATE_WS } from "@/lib/network";

export type ChainStatus = "connecting" | "live" | "unavailable";

type ChainValue = {
  status: ChainStatus;
  chainName: string | null;
  blockNumber: string | null;
  assets: AssetRow[] | null;
  collectionCount: number | null;
  collections: CollectionSummary[] | null;
  poolCount: number | null;
  pools: PoolView[] | null;
  error: string | null;
  readAccount: (address: string, onNative?: (snapshot: AccountSnapshot) => void) => Promise<AccountSnapshot>;
  refreshAssets: () => Promise<void>;
  refreshCollections: () => Promise<void>;
  refreshPools: () => Promise<void>;
  getApi: () => ApiPromise | null;
};

const ChainContext = createContext<ChainValue | null>(null);

export function ChainProvider({ children }: { children: React.ReactNode }) {
  const apiRef = useRef<ApiPromise | null>(null);
  const assetsRef = useRef<AssetRow[]>([]);
  const [status, setStatus] = useState<ChainStatus>("connecting");
  const [chainName, setChainName] = useState<string | null>(null);
  const [blockNumber, setBlockNumber] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetRow[] | null>(null);
  const [collectionCount, setCollectionCount] = useState<number | null>(null);
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [poolCount, setPoolCount] = useState<number | null>(null);
  const [pools, setPools] = useState<PoolView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let headsStarted = false;
    let load = 0;

    async function loadSnapshot(api: ApiPromise) {
      const [chain, header, assetRows, collectionRows, collectionTotal, poolRows, poolTotal] =
        await Promise.all([
          api.rpc.system.chain(),
          api.rpc.chain.getHeader(),
          readAssets(api).catch(() => null),
          readCollectionList(api).catch(() => null),
          countEntries(api, "nfts", "collection").catch(() => null),
          readPools(api).catch(() => null),
          countEntries(api, "assetConversion", "pools").catch(() => null),
        ]);
      return {
        chainName: chain.toString(),
        blockNumber: header.number.toString(),
        assets: assetRows,
        collections: collectionRows,
        collectionCount: collectionTotal,
        pools: poolRows,
        poolCount: poolTotal,
      };
    }

    async function ensureHeads(api: ApiPromise) {
      if (headsStarted) return;
      headsStarted = true;
      try {
        unsubscribe = await api.rpc.chain.subscribeNewHeads((head) => {
          if (!cancelled) setBlockNumber(head.number.toString());
        });
      } catch (cause) {
        headsStarted = false;
        throw cause;
      }
    }

    async function reload(api: ApiPromise) {
      const ticket = ++load;
      try {
        const snapshot = await loadSnapshot(api);
        const applied = applyChainSnapshot(ticket, load, cancelled, snapshot, (value) => {
          assetsRef.current = value.assets ?? [];
          setChainName(value.chainName);
          setBlockNumber(value.blockNumber);
          setAssets(value.assets);
          setCollections(value.collections);
          setCollectionCount(value.collectionCount);
          setPools(value.pools);
          setPoolCount(value.poolCount);
        });
        if (!applied) return;
        await ensureHeads(api);
        if (cancelled || ticket !== load) return;
        setStatus("live");
        setError(null);
      } catch (cause) {
        if (cancelled || ticket !== load) return;
        setStatus("unavailable");
        setError(errorText(cause));
      }
    }

    async function connect() {
      try {
        const { ApiPromise, WsProvider } = await import("@polkadot/api");
        const provider = new WsProvider(SUBSTRATE_WS, 2_500);
        const api = await ApiPromise.create({ provider });
        if (cancelled) {
          await api.disconnect();
          return;
        }
        apiRef.current = api;
        api.on("disconnected", () => {
          if (cancelled) return;
          load += 1;
          setStatus("unavailable");
          setError("The testnet connection dropped. The client will try to reconnect.");
        });
        api.on("connected", () => {
          if (cancelled) return;
          setStatus("connecting");
          setError(null);
          void reload(api);
        });
        await reload(api);
      } catch (cause) {
        if (cancelled) return;
        setStatus("unavailable");
        setError(errorText(cause));
      }
    }

    void connect();

    return () => {
      cancelled = true;
      unsubscribe?.();
      const api = apiRef.current;
      apiRef.current = null;
      void api?.disconnect();
    };
  }, []);

  const refreshCollections = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const [rows, total] = await Promise.all([
      readCollectionList(api),
      countEntries(api, "nfts", "collection"),
    ]);
    setCollections(rows);
    setCollectionCount(total);
  }, []);

  const refreshPools = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const [rows, total] = await Promise.all([
      readPools(api),
      countEntries(api, "assetConversion", "pools"),
    ]);
    setPools(rows);
    setPoolCount(total);
  }, []);

  const refreshAssets = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const rows = await readAssets(api);
    assetsRef.current = rows;
    setAssets(rows);
  }, []);

  const getApi = useCallback(() => apiRef.current, []);

  const readAccountFor = useCallback(async (address: string, onNative?: (snapshot: AccountSnapshot) => void) => {
    const api = apiRef.current;
    if (!api) {
      return {
        free: null,
        spendable: null,
        holdings: [],
        error: "The testnet connection is not available.",
      };
    }
    try {
      return await readAccount(api, address, assetsRef.current, onNative);
    } catch (cause) {
      return { free: null, spendable: null, holdings: [], error: errorText(cause) };
    }
  }, []);

  const value = useMemo<ChainValue>(
    () => ({
      status,
      chainName,
      blockNumber,
      assets,
      collectionCount,
      collections,
      poolCount,
      pools,
      error,
      refreshAssets,
      refreshCollections,
      refreshPools,
      getApi,
      readAccount: readAccountFor,
    }),
    [
      status,
      chainName,
      blockNumber,
      assets,
      collectionCount,
      collections,
      poolCount,
      error,
      refreshAssets,
      refreshCollections,
      refreshPools,
      getApi,
      pools,
      readAccountFor,
    ],
  );

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

export function useChain(): ChainValue {
  const value = useContext(ChainContext);
  if (!value) throw new Error("useChain must be used inside ChainProvider");
  return value;
}
