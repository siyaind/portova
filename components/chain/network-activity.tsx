"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel, Button } from "@/components/ui";
type Feed = {
  indexer: { start_height: number; height: number; updated_at: string } | null;
  events: Array<{
    height: number;
    tx_hash: string;
    tx_index: number;
    call: string;
    success: boolean;
  }>;
};
export function NetworkActivity() {
  const [feed, setFeed] = useState<Feed | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError("");
    void fetch("/api/chain/activity", {
      signal: abort.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setFeed(d);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [refresh]);
  return (
    <Panel className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Recent network activity</h2>
        <Button onClick={() => setRefresh((x) => x + 1)}>Refresh</Button>
      </div>
      {error ? (
        <p className="text-sm text-warn" role="status">
          {error}
        </p>
      ) : feed ? (
        <>
          <p className="text-xs leading-6 text-muted">
            {feed.indexer
              ? `Indexed finalized blocks ${feed.indexer.start_height}–${feed.indexer.height}. Updated ${new Date(feed.indexer.updated_at).toLocaleString()}.`
              : "No finalized range has been indexed yet."}
          </p>
          {feed.events.length ? (
            <ul className="divide-y divide-line">
              {feed.events.map((e) => (
                <li
                  key={`${e.height}:${e.tx_index}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <span>
                    {e.call}
                    <small className="ml-3 text-muted">
                      Block {e.height} · {e.success ? "Succeeded" : "Failed"}
                    </small>
                  </span>
                  <Link
                    className="font-mono text-xs text-violet"
                    href={`/activity?hash=${e.tx_hash}&height=${e.height}`}
                  >
                    {e.tx_hash.slice(0, 10)}… ↗
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              No supported object-related calls in the indexed range.
            </p>
          )}
          <details className="text-xs leading-6 text-muted">
            <summary>Coverage details</summary>
            <p>
              Recent calls associated with native assets, collections and pools.
              This feed is bounded and is not a complete account history, volume
              statistic or revenue report.
            </p>
          </details>
        </>
      ) : (
        <p className="text-sm text-muted">Loading finalized activity…</p>
      )}
    </Panel>
  );
}
