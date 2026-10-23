"use client";

import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { useChain } from "@/components/chain/chain-provider";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { StatusPill } from "@/components/ui";
import type { AccountSnapshot } from "@/lib/chain-read";
import { formatUnits, shortAddress } from "@/lib/format";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";

export function HoldingsTable({ compact = false }: { compact?: boolean }) {
  const chain = useChain();
  const substrate = useSubstrateWallet();
  const evm = useConnection();
  const address = substrate.selected?.address ?? null;
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const assetCount = chain.assets?.length ?? -1;

  useEffect(() => {
    if (!address || chain.status !== "live") {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void chain
      .readAccount(address, (partial) => {
        if (!cancelled && partial.free !== null && !partial.error) setSnapshot(partial);
      })
      .then((next) => {
        if (cancelled) return;
        setSnapshot(next);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSnapshot({ free: null, spendable: null, holdings: [], error: "The account could not be read." });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, assetCount, chain.status, chain.readAccount]);

  return (
    <div>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs tracking-wide text-faint uppercase">
            <th className="px-4 py-3 font-medium">Holding</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Source</th>
            <th className="px-4 py-3 font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line">
            <td className="px-4 py-3">
              <div className="font-medium">{NATIVE_SYMBOL}</div>
              {!compact && address ? (
                <div className="font-mono text-xs text-faint">
                  {shortAddress(address, 8, 6)}
                </div>
              ) : null}
            </td>
            <td className="px-4 py-3 font-mono">
              {nativeAmount(address, chain.status, loading, snapshot)}
            </td>
            <td className="hidden px-4 py-3 text-muted sm:table-cell">System.Account free</td>
            <td className="px-4 py-3">{nativeState(address, chain.status, snapshot)}</td>
          </tr>
          <AssetRows
            address={address}
            loading={loading}
            snapshot={snapshot}
            chainLive={chain.status === "live"}
          />
          <tr className="border-b border-line">
            <td className="px-4 py-3 font-medium">NFTs</td>
            <td className="px-4 py-3 font-mono text-muted">—</td>
            <td className="hidden px-4 py-3 text-muted sm:table-cell">Item ownership</td>
            <td className="px-4 py-3">
              <StatusPill tone="muted">Not scanned</StatusPill>
            </td>
          </tr>
          <tr>
            <td className="px-4 py-3 font-medium">Liquidity</td>
            <td className="px-4 py-3 font-mono text-muted">—</td>
            <td className="hidden px-4 py-3 text-muted sm:table-cell">AssetConversion pools</td>
            <td className="px-4 py-3">
              {chain.poolCount === 0 ? (
                <StatusPill tone="muted">No pools</StatusPill>
              ) : chain.poolCount === null ? (
                <StatusPill tone="warn">Unavailable</StatusPill>
              ) : (
                <StatusPill tone="muted">{chain.poolCount} pools exist</StatusPill>
              )}
            </td>
          </tr>
        </tbody>
      </table>
      {evm.isConnected ? (
        <p className="border-t border-line px-4 py-3 text-xs leading-5 text-muted">
          An EVM wallet is connected. Its native balance is hidden. {NATIVE_SYMBOL}{" "}
          uses {NATIVE_DECIMALS} Substrate decimals, and the Revive scaling ratio
          was not found in storage, so an 18-decimal wallet figure can be wrong.
        </p>
      ) : null}
    </div>
  );
}

function nativeAmount(
  address: string | null,
  status: string,
  loading: boolean,
  snapshot: AccountSnapshot | null,
) {
  const free = snapshot?.free?.replace(/,/g, "") ?? "";
  if (!address) return <span className="text-muted">Connect wallet</span>;
  if (status !== "live") return <span className="text-muted">Unavailable</span>;
  if (snapshot && !snapshot.error && /^\d+$/.test(free)) return formatUnits(free, NATIVE_DECIMALS);
  if (loading || !snapshot) return <span className="text-muted">Reading…</span>;
  return <span className="text-warn">Unavailable</span>;
}

function nativeState(
  address: string | null,
  status: string,
  snapshot: AccountSnapshot | null,
) {
  if (!address) return <StatusPill tone="muted">Not connected</StatusPill>;
  if (status !== "live" || snapshot?.error) {
    return <StatusPill tone="warn">Unavailable</StatusPill>;
  }
  if (!snapshot) return <StatusPill tone="muted">Reading</StatusPill>;
  return <StatusPill tone="ok">Chain read</StatusPill>;
}

function AssetRows({
  address,
  loading,
  snapshot,
  chainLive,
}: {
  address: string | null;
  loading: boolean;
  snapshot: AccountSnapshot | null;
  chainLive: boolean;
}) {
  if (!address || !chainLive) {
    return (
      <tr className="border-b border-line">
        <td className="px-4 py-3 font-medium">Created assets</td>
        <td className="px-4 py-3 font-mono text-muted">—</td>
        <td className="hidden px-4 py-3 text-muted sm:table-cell">Assets.account</td>
        <td className="px-4 py-3">
          <StatusPill tone="muted">
            {address ? "Unavailable" : "Not connected"}
          </StatusPill>
        </td>
      </tr>
    );
  }

  if (snapshot?.error) {
    return (
      <tr className="border-b border-line">
        <td className="px-4 py-3 font-medium">Created assets</td>
        <td className="px-4 py-3 text-warn">Unavailable</td>
        <td className="hidden px-4 py-3 text-muted sm:table-cell">Assets.account</td>
        <td className="px-4 py-3">
          <StatusPill tone="warn">Read failed</StatusPill>
        </td>
      </tr>
    );
  }

  if (loading || !snapshot) {
    return (
      <tr className="border-b border-line">
        <td className="px-4 py-3 font-medium">Created assets</td>
        <td className="px-4 py-3 text-muted">Reading…</td>
        <td className="hidden px-4 py-3 text-muted sm:table-cell">Assets.account</td>
        <td className="px-4 py-3">
          <StatusPill tone="muted">Reading</StatusPill>
        </td>
      </tr>
    );
  }

  if (snapshot.holdings.length === 0) {
    return (
      <tr className="border-b border-line">
        <td className="px-4 py-3 font-medium">Created assets</td>
        <td className="px-4 py-3 font-mono text-muted">None</td>
        <td className="hidden px-4 py-3 text-muted sm:table-cell">Assets.account</td>
        <td className="px-4 py-3">
          <StatusPill tone="ok">No balance</StatusPill>
        </td>
      </tr>
    );
  }

  return snapshot.holdings.map((holding) => (
    <tr key={holding.id} className="border-b border-line">
      <td className="px-4 py-3 font-medium">
        {holding.symbol}
        <span className="ml-2 font-mono text-xs text-faint">#{holding.id}</span>
      </td>
      <td className="px-4 py-3 font-mono">
        {holding.decimals === null
          ? holding.balance
          : formatUnits(holding.balance, holding.decimals)}
      </td>
      <td className="hidden px-4 py-3 text-muted sm:table-cell">Assets.account</td>
      <td className="px-4 py-3">
        <StatusPill tone="ok">Chain read</StatusPill>
      </td>
    </tr>
  ));
}
