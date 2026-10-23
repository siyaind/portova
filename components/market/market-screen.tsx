"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useChain } from "@/components/chain/chain-provider";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { PageIntro, Panel, StatusPill } from "@/components/ui";
import { signAndSend } from "@/lib/assets";
import { outcomeWithoutHash, txResultMessage } from "@/lib/tx-result";
import { errorText, formatUnits, parseDecimalToPlanck } from "@/lib/format";
import { buildBuyItem, buildSetPrice, readItemSale, readTradingEnabled, scanListings, type Listing } from "@/lib/market";
import { readItemProfile } from "@/lib/nfts";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import { isProceedsAddress } from "@/lib/project";

const FIELD = "h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm";

export function MarketScreen() {
  const chain = useChain();
  const wallet = useSubstrateWallet();
  const txs = useTxs();
  const params = useSearchParams();
  const signer = wallet.selected;
  const [trading, setTrading] = useState<boolean | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [scanState, setScanState] = useState<"idle" | "reading" | "ready" | "error">("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState(params.get("collection") ?? "");
  const [itemId, setItemId] = useState(params.get("item") ?? "");
  const [price, setPrice] = useState("");
  const [buyer, setBuyer] = useState("");
  const [bid, setBid] = useState("");
  const [sale, setSale] = useState<Listing | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const api = chain.getApi();
    if (chain.status !== "live" || !api) return;
    setTrading(readTradingEnabled(api));
  }, [chain.status, chain.getApi]);

  useEffect(() => {
    const api = chain.getApi();
    if (chain.status !== "live" || !api) return;
    if (chain.collections === null) return;
    let cancelled = false;
    setScanState("reading");
    setScanError(null);
    void scanListings(
      api,
      chain.collections.map((collection) => collection.id),
    )
      .then((next) => {
        if (cancelled) return;
        setListings(next);
        setScanState("ready");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setListings(null);
        setScanError(errorText(cause));
        setScanState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [chain.status, chain.collections, chain.getApi]);

  const tradingOff = trading !== true;
  const saleKey = `${collectionId.trim()}:${itemId.trim()}`;
  const idsValid = /^\d+$/.test(collectionId.trim()) && /^\d+$/.test(itemId.trim());

  useEffect(() => {
    setSale(null);
  }, [saleKey]);

  async function loadSale() {
    setMessage(null);
    const api = chain.getApi();
    if (!api || !idsValid) {
      setMessage("Enter a collection id and an item id.");
      return;
    }
    try {
      const [nextSale, item] = await Promise.all([
        readItemSale(api, collectionId.trim(), itemId.trim()),
        readItemProfile(api, collectionId.trim(), itemId.trim()),
      ]);
      const listing: Listing = {
        ...nextSale,
        collectionId: collectionId.trim(),
        itemId: itemId.trim(),
        owner: item.owner,
        metadata: item.metadata,
      };
      setSale(listing);
      if (nextSale.price) setBid(formatUnits(nextSale.price, NATIVE_DECIMALS));
    } catch (cause) {
      setMessage(errorText(cause));
    }
  }

  async function submit(kind: "list" | "cancel" | "buy") {
    setMessage(null);
    if (!signer) {
      await wallet.connect();
      return;
    }
    if (trading !== true) {
      setMessage("Trading is disabled on this runtime, so the wallet was not asked to sign.");
      return;
    }
    const api = chain.getApi();
    if (!api || !idsValid) {
      setMessage("Enter a collection id and an item id.");
      return;
    }
    const collection = Number(collectionId.trim());
    const item = Number(itemId.trim());
    let freshSale;
    let current;
    try {
      freshSale = await readItemSale(api, String(collection), String(item));
      current = await readItemProfile(api, String(collection), String(item));
    } catch (cause) {
      setMessage(errorText(cause));
      return;
    }
    if (kind === "buy" && (!freshSale.listed || !freshSale.price)) {
      setSale(null);
      setMessage("This item is not listed, so the wallet was not opened.");
      return;
    }
    if (!current.found || !current.owner) {
      setMessage("That item is not minted, so no price was submitted.");
      return;
    }
    const id = crypto.randomUUID();
    setBusy(kind);
    try {
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injected = await web3FromSource(signer.source);
      if (!injected.signer) throw new Error("This wallet did not provide a signer.");
      let tx;
      let label = "";
      if (kind === "buy") {
        if (current.owner === signer.address) {
          setMessage("The owner cannot buy their own item.");
          return;
        }
        const listed = await readItemSale(api, String(collection), String(item));
        const bidRaw = parseDecimalToPlanck(bid, NATIVE_DECIMALS);
        if (!listed.listed || !listed.price || bidRaw === null) {
          setMessage("This item is not listed, or the bid is not a tPOT amount.");
          return;
        }
        if (listed.buyer && listed.buyer !== signer.address) {
          setMessage("The listing names a different buyer.");
          return;
        }
        if (bidRaw < BigInt(listed.price)) {
          setMessage("The bid is below the listed price.");
          return;
        }
        tx = buildBuyItem(api, collection, item, bidRaw);
        label = `Buy item ${collection}/${item}`;
      } else {
        if (current.owner !== signer.address) {
          setMessage("Only the item owner can set or clear the price.");
          return;
        }
        if (kind === "cancel") {
          tx = buildSetPrice(api, collection, item, null, null);
          label = `Cancel listing ${collection}/${item}`;
        } else {
          const priceRaw = parseDecimalToPlanck(price, NATIVE_DECIMALS);
          if (priceRaw === null || priceRaw <= BigInt(0)) {
            setMessage("Enter a price greater than zero.");
            return;
          }
          const namedBuyer = buyer.trim();
          if (namedBuyer && !isProceedsAddress(namedBuyer)) {
            setMessage("The named buyer is not a testnet address, so the wallet was not opened.");
            return;
          }
          tx = buildSetPrice(api, collection, item, priceRaw, namedBuyer || null);
          label = `List item ${collection}/${item}`;
        }
      }
      txs.push({ id, label, status: "signing" });
      const result = await signAndSend(api, tx, signer.address, injected.signer, (update) => txs.patch(id, update));
      if (result.status === "finalized" || result.status === "included") await loadSale();
      setMessage(txResultMessage(result.status, result.error));
    } catch (cause) {
      const text = errorText(cause);
      setMessage(text);
      txs.patch(id, outcomeWithoutHash(text));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="NFT marketplace"
        title="Fixed-price items"
        body="A listing is nfts.set_price. A purchase is nfts.buy_item. The bid is paid in tPOT to the seller. This pallet has no royalty and no marketplace fee."
      />
      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Trading feature</h2>
          {trading === null ? (
            <StatusPill tone="warn">{chain.status === "connecting" ? "Reading" : "Unknown"}</StatusPill>
          ) : trading ? (
            <StatusPill tone="ok">Enabled</StatusPill>
          ) : (
            <StatusPill tone="bad">Disabled</StatusPill>
          )}
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">
          {trading === false
            ? "Nfts.Features is 0. Trading is bit 1, so set_price and buy_item are disabled by the runtime. A signature would fail with MethodDisabled. The buttons stay off."
            : trading === true
              ? "The runtime has the Trading bit set. List and buy each ask for their own signature."
              : chain.status === "connecting"
                ? "Reading the testnet."
                : "The feature flag has not been read yet."}
        </p>
      </Panel>
      <Panel>
        <div className="border-b border-line px-4 py-3 text-sm font-medium">Listed items</div>
        {scanState === "reading" || (listings === null && scanState !== "error") ? (
          <p className="px-4 py-6 text-sm text-muted">
            {chain.status === "connecting"
              ? "Waiting for the testnet connection."
              : chain.collections === null
                ? "The collection index is unavailable, so listings were not scanned."
                : "Reading item prices."}
          </p>
        ) : scanState === "error" ? (
          <p className="px-4 py-6 text-sm text-warn">
            The listing scan failed.{scanError ? ` ${scanError}` : ""}
          </p>
        ) : listings === null || listings.length === 0 ? (
          <p className="px-4 py-6 text-sm leading-6 text-muted">
            No price was found on items 0–23 in the known collections. A missing row is not a floor price of zero.
          </p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs tracking-wide text-faint uppercase">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <tr key={`${listing.collectionId}-${listing.itemId}`} className="border-b border-line">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-blue"
                        onClick={() => {
                          setCollectionId(listing.collectionId);
                          setItemId(listing.itemId);
                          setSale(listing);
                          if (listing.price) setBid(formatUnits(listing.price, NATIVE_DECIMALS));
                        }}
                      >
                        {listing.collectionId}/{listing.itemId}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {listing.price ? `${formatUnits(listing.price, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}` : "Unavailable"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs break-all">{listing.owner ?? "Unavailable"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel className="space-y-4 p-4">
          <h2 className="text-sm font-medium">List or cancel</h2>
          <IdFields collectionId={collectionId} itemId={itemId} onCollection={setCollectionId} onItem={setItemId} />
          <label className="block text-xs text-muted">
            Price ({NATIVE_SYMBOL})
            <input className={`${FIELD} mt-1.5 font-mono`} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
          </label>
          <label className="block text-xs text-muted">
            Only this buyer
            <input className={`${FIELD} mt-1.5 font-mono text-xs`} value={buyer} placeholder="Blank means any account" onChange={(event) => setBuyer(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Action disabled={tradingOff || Boolean(busy)} onClick={() => void submit("list")}>
              {trading === null ? "Reading" : tradingOff ? "Trading disabled" : busy === "list" ? "Waiting for the wallet…" : signer ? "List item" : "Connect Substrate wallet"}
            </Action>
            <Action disabled={tradingOff || Boolean(busy)} onClick={() => void submit("cancel")}>
              {trading === null ? "Reading" : tradingOff ? "Trading disabled" : busy === "cancel" ? "Waiting…" : "Cancel listing"}
            </Action>
            <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void loadSale()}>
              Read price
            </button>
          </div>
        </Panel>
        <Panel className="space-y-4 p-4">
          <h2 className="text-sm font-medium">Buy</h2>
          <p className="text-sm leading-6 text-muted">
            {sale?.listed && sale.price
              ? `Listed at ${formatUnits(sale.price, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}.`
              : sale && !sale.owner
                ? "No minted item was found at this id, and itemPriceOf has no price."
                : sale
                  ? "This item has no price. It is not for sale."
                  : "Read the item before buying. An unread item is not treated as free."}
          </p>
          {sale?.owner ? <p className="font-mono text-xs break-all text-muted">Owner {sale.owner}</p> : null}
          {sale?.metadata ? <p className="font-mono text-xs break-all text-faint">{sale.metadata}</p> : null}
          <label className="block text-xs text-muted">
            Bid ({NATIVE_SYMBOL})
            <input className={`${FIELD} mt-1.5 font-mono`} inputMode="decimal" value={bid} onChange={(event) => setBid(event.target.value)} />
          </label>
          <Action disabled={tradingOff || Boolean(busy) || !sale?.listed} onClick={() => void submit("buy")}>
            {trading === null ? "Reading" : tradingOff ? "Trading disabled" : busy === "buy" ? "Waiting for the wallet…" : signer ? "Buy item" : "Connect Substrate wallet"}
          </Action>
          <p className="text-xs leading-5 text-faint">
            The bid is paid to the seller.{" "}
            <Link href="/explore" className="text-blue hover:underline">
              Collections
            </Link>
          </p>
        </Panel>
      </div>
      {message ? <p className="text-sm leading-6 text-warn">{message}</p> : null}
    </div>
  );
}

function IdFields({
  collectionId,
  itemId,
  onCollection,
  onItem,
}: {
  collectionId: string;
  itemId: string;
  onCollection: (value: string) => void;
  onItem: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs text-muted">
        Collection
        <input className={`${FIELD} mt-1.5 font-mono`} inputMode="numeric" value={collectionId} onChange={(event) => onCollection(event.target.value)} />
      </label>
      <label className="block text-xs text-muted">
        Item
        <input className={`${FIELD} mt-1.5 font-mono`} inputMode="numeric" value={itemId} onChange={(event) => onItem(event.target.value)} />
      </label>
    </div>
  );
}

function Action({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg bg-violet px-3 py-2 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
