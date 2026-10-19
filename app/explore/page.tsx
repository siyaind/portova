"use client";

import Link from "next/link";
import { useState } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { PageIntro, Panel, StatusPill } from "@/components/ui";

const FILTERS = ["All", "Tokens", "Collections", "Pools"] as const;

export default function ExplorePage() {
  const chain = useChain();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const showTokens = filter === "All" || filter === "Tokens";
  const showCollections = filter === "All" || filter === "Collections";
  const showPools = filter === "All" || filter === "Pools";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Explore"
        title="What is on the testnet"
        body="Token rows are asset metadata read from the Assets pallet. Counts for collections and pools are storage sizes. There is no price, volume, or floor."
      />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              filter === item
                ? "border-violet bg-panel-2 text-ink"
                : "border-line text-muted hover:text-ink"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      {showTokens ? (
        <Panel>
          <div className="border-b border-line px-4 py-3 text-sm font-medium">
            Fungible assets
          </div>
          {chain.status === "connecting" ? (
            <p className="px-4 py-8 text-sm text-muted">Reading testnet metadata…</p>
          ) : chain.assets === null ? (
            <p className="px-4 py-8 text-sm text-warn">
              Asset metadata is unavailable.
              {chain.error ? ` ${chain.error}` : ""}
            </p>
          ) : chain.assets.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">
              No asset metadata is stored.
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs tracking-wide text-faint uppercase">
                    <th className="px-4 py-3 font-medium">Id</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Symbol</th>
                    <th className="px-4 py-3 font-medium">Decimals</th>
                    <th className="px-4 py-3 font-medium">Frozen</th>
                  </tr>
                </thead>
                <tbody>
                  {chain.assets.map((asset) => (
                    <tr key={asset.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-mono">
                        <Link href={`/token/${asset.id}`} className="text-blue hover:underline">
                          {asset.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/token/${asset.id}`} className="hover:underline">
                          {asset.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono">{asset.symbol}</td>
                      <td className="px-4 py-3 font-mono">
                        {asset.decimals ?? "Unavailable"}
                      </td>
                      <td className="px-4 py-3">
                        {asset.frozen === null ? (
                          "Unavailable"
                        ) : asset.frozen ? (
                          <StatusPill tone="warn">Frozen</StatusPill>
                        ) : (
                          <StatusPill tone="ok">No</StatusPill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}
      {showCollections ? (
        chain.collections && chain.collections.length > 0 ? (
          <Panel>
            <div className="border-b border-line px-4 py-3 text-sm font-medium">
              NFT collections
            </div>
            <div className="max-w-full overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs tracking-wide text-faint uppercase">
                    <th className="px-4 py-3 font-medium">Id</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {chain.collections.map((collection) => (
                    <tr key={collection.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-mono">
                        <Link href={`/collection/${collection.id}`} className="text-blue hover:underline">
                          {collection.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs break-all">{collection.owner ?? "Unavailable"}</td>
                      <td className="px-4 py-3 font-mono">{collection.items ?? "Unavailable"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : (
          <EmptyCount
            title="NFT collections"
            count={chain.collectionCount}
            empty="The Nfts pallet has no collection records. Gallery pages stay empty until one is created."
          />
        )
      ) : null}
      {showPools ? (
        chain.pools && chain.pools.length > 0 ? (
          <Panel className="p-4">
            <h2 className="text-sm font-medium">Liquidity pools</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {chain.pools.map((pool) => (
                <li key={`${pool.lpToken}`}>
                  <Link href="/liquidity" className="text-blue hover:underline">
                    Pool LP #{pool.lpToken}
                  </Link>
                  <span className="ml-2 text-muted">
                    {pool.reserve1 === null || pool.reserve2 === null
                      ? "Reserves unavailable"
                      : "Reserves read from the chain"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyCount
            title="Liquidity pools"
            count={chain.poolCount}
            empty="AssetConversion has no pool records. Swap quotes stay off until a pool has reserves."
          />
        )
      ) : null}
    </div>
  );
}

function EmptyCount({
  title,
  count,
  empty,
}: {
  title: string;
  count: number | null;
  empty: string;
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="font-mono text-sm">
          {count === null ? "Unavailable" : count}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        {count === null
          ? "The storage query did not return a count."
          : count === 0
            ? empty
            : `${count} storage records exist. This build does not render their details yet.`}
      </p>
    </Panel>
  );
}
