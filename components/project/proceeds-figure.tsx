"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useChain } from "@/components/chain/chain-provider";
import type { AccountSnapshot, HoldingRow } from "@/lib/chain-read";
import { errorText, formatUnits } from "@/lib/format";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import { isProceedsAddress } from "@/lib/project";

export type ProceedsStatus = "empty" | "invalid" | "waiting" | "reading" | "ready" | "unavailable";

export function useProceedsBalance(address: string): {
  status: ProceedsStatus;
  free: string | null;
  holdings: HoldingRow[];
  error: string | null;
} {
  const chain = useChain();
  const trimmed = address.trim();
  const valid = isProceedsAddress(trimmed);
  const [row, setRow] = useState<{ address: string; snapshot: AccountSnapshot } | null>(null);

  useEffect(() => {
    if (!valid || chain.status !== "live") return;
    let cancelled = false;
    void chain
      .readAccount(trimmed)
      .then((snapshot) => {
        if (!cancelled) setRow({ address: trimmed, snapshot });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setRow({
            address: trimmed,
            snapshot: { free: null, holdings: [], error: errorText(cause) },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [valid, trimmed, chain.status, chain.readAccount]);

  const current = row?.address === trimmed ? row.snapshot : null;
  if (!trimmed) return { status: "empty", free: null, holdings: [], error: null };
  if (!valid) return { status: "invalid", free: null, holdings: [], error: null };
  if (chain.status === "unavailable") {
    return { status: "unavailable", free: null, holdings: [], error: chain.error };
  }
  if (!current) {
    return {
      status: chain.status === "live" ? "reading" : "waiting",
      free: null,
      holdings: [],
      error: null,
    };
  }
  const free = current.free?.replace(/,/g, "") ?? null;
  if (current.error || !free || !/^\d+$/.test(free)) {
    return {
      status: "unavailable",
      free: null,
      holdings: [],
      error: current.error ?? "The free balance was not returned.",
    };
  }
  return { status: "ready", free, holdings: current.holdings, error: null };
}

export function ProceedsFigure({ address }: { address: string }) {
  return <ProceedsBody address={address} balance={useProceedsBalance(address)} />;
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
        {balance.holdings.length === 0 ? (
          <p>No created-asset balance above zero was returned for this account.</p>
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
