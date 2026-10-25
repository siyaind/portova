"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useChain } from "@/components/chain/chain-provider";
import type { AccountSnapshot, HoldingRow } from "@/lib/chain-read";
import { errorText, formatUnits } from "@/lib/format";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import { isProceedsAddress } from "@/lib/project";
import { useTxs } from "@/components/tx/tx-tracker";
import { sameAccount } from "@/lib/withdrawal";

export type ProceedsStatus = "empty" | "invalid" | "waiting" | "reading" | "ready" | "unavailable";

export function useProceedsBalance(address: string, revision = 0): {
  status: ProceedsStatus;
  free: string | null;
  holdings: HoldingRow[];
  error: string | null;
  assetsPending: boolean;
  loadedAt?: number; blockNumber?: string; holdingsComplete?: boolean; coverageNote?: string;
} {
  const chain = useChain();
  const txs = useTxs();
  const trimmed = address.trim();
  const valid = isProceedsAddress(trimmed);
  const [row, setRow] = useState<{ address: string; snapshot: AccountSnapshot } | null>(null);
  const [assetsPending, setAssetsPending] = useState(false);

  const [tick, setTick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setTick(value => value + 1), 30_000); return () => window.clearInterval(timer); }, []);
  const settled = txs.items.filter(item => sameAccount(item.account, trimmed) && ["finalized", "failed"].includes(item.status)).map(item => `${item.id}:${item.status}:${item.actualFee ?? ""}`).join("|");

  useEffect(() => {
    if (!valid || chain.status !== "live") {
      setAssetsPending(false);
      return;
    }
    let cancelled = false;
    setAssetsPending(true);
    void chain
      .readAccount(trimmed, (snapshot) => {
        if (!cancelled && snapshot.free !== null && !snapshot.error) setRow({ address: trimmed, snapshot });
      })
      .then((snapshot) => {
        if (cancelled) return;
        setRow({ address: trimmed, snapshot });
        setAssetsPending(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setAssetsPending(false);
        setRow({
          address: trimmed,
          snapshot: { free: null, spendable: null, holdings: [], error: errorText(cause) },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [valid, trimmed, chain.assets, chain.discovery.assets.complete, chain.status, chain.readAccount, revision, tick, settled]);

  const current = row?.address === trimmed ? row.snapshot : null;
  if (!trimmed) return { status: "empty", free: null, holdings: [], error: null, assetsPending: false };
  if (!valid) return { status: "invalid", free: null, holdings: [], error: null, assetsPending: false };
  if (chain.status === "unavailable") {
    return { status: "unavailable", free: null, holdings: [], error: chain.error, assetsPending: false };
  }
  if (!current) {
    return {
      status: chain.status === "live" ? "reading" : "waiting",
      free: null,
      holdings: [],
      error: null,
      assetsPending: false,
    };
  }
  const free = current.free?.replace(/,/g, "") ?? null;
  if (current.error || !free || !/^\d+$/.test(free)) {
    return {
      status: "unavailable",
      free: null,
      holdings: [],
      error: current.error ?? "The free balance was not returned.",
      assetsPending: false,
    };
  }
  return { status: "ready", free, holdings: current.holdings, error: null, assetsPending, loadedAt: current.loadedAt, blockNumber: current.blockNumber, holdingsComplete: current.holdingsComplete, coverageNote: current.coverageNote };
}

export function ProceedsFigure({ address, revision = 0 }: { address: string; revision?: number }) {
  return <ProceedsBody address={address} balance={useProceedsBalance(address, revision)} />;
}

export function ProceedsBody({
  address,
  balance,
}: {
  address: string;
  balance: ReturnType<typeof useProceedsBalance>;
}) {
  const trimmed = address.trim();
  let body: ReactNode;
  if (balance.status === "empty") {
    body = <p>No proceeds account is linked. Mint and sale proceeds stay where the chain paid them.</p>;
  } else if (balance.status === "invalid") {
    body = <p>This address failed the SS58 prefix 42 check, so no balance was requested.</p>;
  } else if (balance.status === "waiting") {
    body = <p>Waiting for the testnet read.</p>;
  } else if (balance.status === "reading") {
    body = <p>Reading System.Account.</p>;
  } else if (balance.status !== "ready" || balance.free === null) {
    body = <p>{balance.error ?? "The free balance was not returned."} The figure stays blank.</p>;
  } else {
    body = (
      <>
        <p className="font-mono text-sm">
          {formatUnits(balance.free, NATIVE_DECIMALS)} {NATIVE_SYMBOL}
        </p>
        <p>System.Account free balance of the proceeds account.</p>
        {balance.loadedAt && <p className="text-xs text-faint">Snapshot {new Date(balance.loadedAt).toLocaleTimeString()} · finalized block {balance.blockNumber}. Refreshes every 30 seconds and after settled transactions.</p>}
        {balance.coverageNote && <p role="status" className="text-xs text-warn">{balance.coverageNote}</p>}
        {balance.assetsPending ? (
          <p>Reading created-asset balances.</p>
        ) : balance.holdings.length === 0 ? (
          <p>{balance.holdingsComplete === false ? "Created-asset balances are not fully verified. Retry discovery and balances." : "No created-asset balance above zero was returned for this account."}</p>
        ) : (
          <ul className="space-y-1">
            {balance.holdings.map((holding) => (
              <li key={holding.id}>
                <Link href={`/token/${holding.id}`} className="text-blue hover:underline">
                  {holding.symbol} #{holding.id}
                </Link>{" "}
                <span className="font-mono">{holdingAmount(holding)}</span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <div className="space-y-2">
      {trimmed ? <p className="font-mono text-sm break-all">{trimmed}</p> : null}
      {body}
    </div>
  );
}

function holdingAmount(holding: HoldingRow): string {
  const raw = holding.balance.replace(/,/g, "");
  if (holding.decimals === null || !/^\d+$/.test(raw)) return `${holding.balance} raw`;
  return formatUnits(raw, holding.decimals);
}
