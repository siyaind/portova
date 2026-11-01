"use client";
import { useEffect, useState } from "react";
import { Panel, StatusPill, Button } from "@/components/ui";
import { formatUnits } from "@/lib/format";
import { NATIVE_DECIMALS, NATIVE_SYMBOL, BLOCK_EXPLORER } from "@/lib/network";
export function AccountProfile({ address }: { address: string }) {
  const [data, setData] = useState<{
      account: string;
      block: string;
      free: string;
      reserved: string;
    } | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setError("");
    void fetch(`/api/chain/account?address=${encodeURIComponent(address)}`, {
      signal: abort.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [address, refresh]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="product-heading">
        <div>
          <p className="product-eyebrow">Public account</p>
          <h1>Account overview</h1>
          <p>
            Native balances read from a finalized Portaldot V3 Testnet block.
          </p>
        </div>
      </section>
      <Panel className="space-y-5 p-6">
        <p className="break-all font-mono text-sm">
          {data?.account ?? address}
        </p>
        {error ? (
          <p className="text-warn" role="alert">
            {error}
          </p>
        ) : data ? (
          <>
            <StatusPill tone="muted">Block {data.block}</StatusPill>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted">Free balance</dt>
                <dd className="mt-2 text-2xl font-semibold">
                  {formatUnits(data.free, NATIVE_DECIMALS)} {NATIVE_SYMBOL}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Reserved balance</dt>
                <dd className="mt-2 text-2xl font-semibold">
                  {formatUnits(data.reserved, NATIVE_DECIMALS)} {NATIVE_SYMBOL}
                </dd>
              </div>
            </dl>
            <p className="text-sm leading-7 text-muted">
              Free balance may include restrictions. This view does not scan
              tokens, NFTs or account transaction history.
            </p>
          </>
        ) : (
          <p role="status">Reading account…</p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={() => setRefresh((x) => x + 1)}>
            Refresh account
          </Button>
          <a
            href={BLOCK_EXPLORER}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-violet"
          >
            Open network explorer ↗
          </a>
        </div>
      </Panel>
    </div>
  );
}
