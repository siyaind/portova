"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import Link from "next/link";
import { useChain } from "@/components/chain/chain-provider";
import { isExtrinsicHash, txStatusLabel, useTxs } from "@/components/tx/tx-tracker";
import { WalletDialog } from "@/components/wallet/wallet-dialog";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { CHAIN_ID } from "@/lib/network";
import { shortAddress } from "@/lib/format";
import { useConnection } from "wagmi";

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const chain = useChain();
  const substrate = useSubstrateWallet();
  const evm = useConnection();
  const txs = useTxs();
  const pending = txs.items.filter(
    (item) => item.status === "signing" || item.status === "submitted" || item.status === "included",
  ).length;
  const [walletOpen, setWalletOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const txRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!txRef.current?.contains(event.target as Node)) setTxOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setTxOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const dot =
    chain.status === "live" ? "bg-ok" : chain.status === "connecting" ? "bg-warn" : "bg-bad";

  const walletLabel = substrate.selected
    ? shortAddress(substrate.selected.address, 4, 4)
    : evm.address
      ? shortAddress(evm.address, 4, 4)
      : "Connect";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg px-3 sm:gap-3 sm:px-4">
      <button
        type="button"
        className="rounded-md p-2 text-muted hover:bg-panel-2 hover:text-ink lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenNav}
      >
        <Menu size={18} />
      </button>
      <SearchBox />
      <div
        className="hidden items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs sm:flex"
        title="This build only talks to Portaldot V3 testnet."
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
        <span>Portaldot V3 Testnet</span>
        <span className="font-mono text-faint">{CHAIN_ID}</span>
        {chain.blockNumber ? (
          <span className="font-mono text-muted">#{chain.blockNumber}</span>
        ) : null}
      </div>
      <div className="relative" ref={txRef}>
        <button
          type="button"
          aria-expanded={txOpen}
          aria-haspopup="dialog"
          className="relative rounded-md p-2 text-muted hover:bg-panel-2 hover:text-ink"
          onClick={() => setTxOpen((open) => !open)}
        >
          <Bell size={18} />
          {pending > 0 ? (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-violet" />
          ) : null}
          <span className="sr-only">
            {pending > 0
              ? `${pending} transaction${pending === 1 ? "" : "s"} in progress`
              : "Transaction notifications"}
          </span>
        </button>
        {txOpen ? (
          <div
            role="dialog"
            aria-label="Transactions"
            className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-panel p-4 shadow-2xl shadow-black/40"
          >
            <p className="text-sm font-medium">Transactions</p>
            {txs.items.length === 0 ? (
              <p className="mt-2 text-sm leading-6 text-muted">
                No transactions yet. A hash appears here only after the node
                returns one.
              </p>
            ) : (
              <ul className="mt-3 max-h-80 space-y-3 overflow-y-auto">
                {txs.items.map((item) => (
                  <li key={item.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
                    <p className="text-sm">{item.label}</p>
                    <p className="mt-1 text-xs tracking-wide text-faint uppercase">
                      {txStatusLabel(item.status)}
                    </p>
                    {isExtrinsicHash(item.hash) ? (
                      <p className="mt-1 font-mono text-xs break-all text-muted">{item.hash}</p>
                    ) : null}
                    {item.error ? (
                      <p className="mt-1 text-xs leading-5 text-warn">{item.error}</p>
                    ) : null}
                    {item.collectionId ? (
                      <Link
                        href={`/collection/${item.collectionId}`}
                        className="mt-1 inline-block text-xs text-blue hover:underline"
                      >
                        Open collection
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm hover:bg-panel-2"
        onClick={() => setWalletOpen(true)}
      >
        {walletLabel}
      </button>
      <WalletDialog open={walletOpen} onClose={() => setWalletOpen(false)} />
    </header>
  );
}

function searchResult(
  raw: string,
  assets: { id: string; name: string; symbol: string; decimals: number | null }[] | null,
  collections: { id: string }[] | null,
): { text: string; links?: { href: string; label: string }[] } | null {
  const query = raw.trim();
  if (!query) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(query)) {
    return {
      text: "EVM address recognized. This shell does not look up an arbitrary address, and it does not treat an EVM native balance as tPOT.",
    };
  }
  if (/^5[1-9A-HJ-NP-Za-km-z]{47}$/.test(query)) {
    return {
      text: "Substrate address recognized. Connect that account in the wallet to read its free balance. Arbitrary address lookup is not connected.",
    };
  }
  if (/^\d+$/.test(query)) {
    const asset = assets?.find((row) => row.id === query);
    const collection = collections?.find((row) => row.id === query);
    if (asset) {
      return {
        text: `Asset ${asset.id}: ${asset.name} (${asset.symbol}), ${asset.decimals ?? "unknown"} decimals. This is metadata from the testnet. It is not a price or a balance.`,
        links: [
          { href: `/token/${asset.id}`, label: "Open token" },
          { href: `/collection/${query}`, label: "Open collection id" },
        ],
      };
    }
    if (assets === null) {
      return {
        text: "Asset metadata is still loading. Press Enter again after the token list appears.",
      };
    }
    return {
      text: collection
        ? `No asset metadata uses id ${query}. A collection with this id is stored.`
        : `No asset metadata uses id ${query}. You can still open the collection page for a direct read.`,
      links: [{ href: `/collection/${query}`, label: "Open collection" }],
    };
  }
  return { text: "Search accepts an asset id, a 0x address, or a Substrate address." };
}

function SearchBox() {
  const chain = useChain();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<{
    text: string;
    links?: { href: string; label: string }[];
  } | null>(null);
  const formId = useId();
  const boxRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setResult(null);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  useEffect(() => {
    setResult(searchResult(value, chain.assets, chain.collections));
  }, [value, chain.assets, chain.collections]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next = searchResult(value, chain.assets, chain.collections);
    setResult(next);
    const href = next?.links?.[0]?.href;
    if (href) router.push(href);
  }

  return (
    <form ref={boxRef} onSubmit={onSubmit} className="relative min-w-0 flex-1">
      <label htmlFor={formId} className="sr-only">
        Search asset id, collection id, or address
      </label>
      <Search
        size={15}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <input
        id={formId}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Asset id, collection id, or address"
        className="h-9 w-full rounded-lg border border-line bg-panel pr-3 pl-9 text-sm text-ink placeholder:text-faint"
      />
      {result ? (
        <div
          role="status"
          className="absolute top-11 right-0 left-0 z-20 rounded-lg border border-line bg-panel p-3 text-sm leading-6 text-muted shadow-2xl shadow-black/40"
        >
          <p>{result.text}</p>
          {result.links?.map((link) => (
            <Link key={link.href} href={link.href} className="mt-2 mr-4 inline-block text-blue hover:underline">
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </form>
  );
}
