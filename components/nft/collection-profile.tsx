"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useChain } from "@/components/chain/chain-provider";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { PageIntro, Panel, StatusPill } from "@/components/ui";
import { signAndSend } from "@/lib/assets";
import { errorText, formatUnits } from "@/lib/format";
import {
  COLLECTION_ROLE,
  COLLECTION_SETTING,
  featureEnabled,
  hasBit,
  buildMintItem,
  readCollectionProfile,
  readItemProfile,
  type CollectionProfile,
  type ItemProfile,
} from "@/lib/nfts";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import { isProceedsAddress } from "@/lib/project";
import { outcomeWithoutHash, txResultMessage } from "@/lib/tx-result";

export function CollectionProfile({ id }: { id: string }) {
  const chain = useChain();
  const search = useSearchParams();
  const queryItem = search.get("item") ?? "";
  const [profile, setProfile] = useState<CollectionProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [itemId, setItemId] = useState(queryItem);
  const [item, setItem] = useState<ItemProfile | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);

  useEffect(() => {
    if (/^\d+$/.test(queryItem)) setItemId(queryItem);
  }, [queryItem]);

  useEffect(() => {
    if (!/^\d+$/.test(id)) {
      setProfile(null);
      setError("Collection id must be a whole number.");
      return;
    }
    const api = chain.getApi();
    if (chain.status === "connecting" || !api) return;
    if (chain.status === "unavailable") {
      setError(chain.error ?? "The testnet read is unavailable.");
      setProfile(null);
      return;
    }
    let cancelled = false;
    setError(null);
    void readCollectionProfile(api, id)
      .then((next) => {
        if (!cancelled) setProfile(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorText(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [id, chain, chain.status]);

  useEffect(() => {
    if (!profile?.found || !/^\d+$/.test(itemId)) {
      setItem(null);
      return;
    }
    const api = chain.getApi();
    if (!api) return;
    let cancelled = false;
    setItemError(null);
    void readItemProfile(api, id, itemId)
      .then((next) => {
        if (!cancelled) setItem(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setItemError(errorText(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.found, itemId, id, chain]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Collection"
        title={profile?.found ? `Collection ${id}` : `Collection ${id}`}
        body="Owner, mint rules, and metadata are read from the Nfts pallet. This page does not show a floor price."
      />
      <p className="text-sm">
        <Link href="/explore" className="text-blue hover:underline">
          Back to explore
        </Link>
      </p>
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {!error && !profile ? <p className="text-sm text-muted">Reading collection {id}…</p> : null}
      {profile && !profile.found ? (
        <Panel className="p-4">
          <p className="text-sm text-muted">
            No Nfts collection uses id {id}. A missing collection is not an empty gallery with a price.
          </p>
        </Panel>
      ) : null}
      {profile?.found ? (
        <ProfileBody
          profile={profile}
          itemId={itemId}
          item={item}
          itemError={itemError}
          onItemId={setItemId}
        />
      ) : null}
    </div>
  );
}

function ProfileBody({
  profile,
  itemId,
  item,
  itemError,
  onItemId,
}: {
  profile: CollectionProfile;
  itemId: string;
  item: ItemProfile | null;
  itemError: string | null;
  onItemId: (value: string) => void;
}) {
  const transferable = featureEnabled(profile.settings, COLLECTION_SETTING.TransferableItems);
  const editable = featureEnabled(profile.settings, COLLECTION_SETTING.UnlockedMetadata);
  const depositRequired = featureEnabled(profile.settings, COLLECTION_SETTING.DepositRequired);
  const roles = profile.roles ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Collection</h2>
        <dl>
          <Row term="Id" value={profile.id} mono />
          <Row term="Owner" value={profile.owner ?? "Unavailable"} mono />
          <Row term="Items" value={profile.items ?? "Unavailable"} mono />
          <Row term="Item metadata records" value={profile.itemMetadatas ?? "Unavailable"} mono />
          <Row term="Max supply" value={profile.maxSupply ?? "Unavailable"} mono />
          <Row term="Mint type" value={profile.mintType ?? "Unavailable"} />
          <Row
            term="Mint price"
            value={
              profile.price
                ? `${formatUnits(profile.price, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}`
                : "None"
            }
            mono
          />
          <Row
            term="Owner deposit"
            value={
              profile.ownerDeposit
                ? `${formatUnits(profile.ownerDeposit, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}`
                : "Unavailable"
            }
            mono
          />
        </dl>
      </Panel>
      <Panel>
        <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Rules</h2>
        <div className="space-y-3 px-4 py-3 text-sm">
          <Flag label="Transfers" value={transferable} on="Items can be transferred" off="Items cannot be transferred" />
          <Flag
            label="Metadata"
            value={editable}
            on="Metadata can still be changed"
            off="Metadata is locked"
          />
          <Flag
            label="Item deposit"
            value={depositRequired}
            on="The item deposit requirement is enabled"
            off="The item deposit requirement is disabled on this collection"
          />
          <p className="text-xs leading-5 text-faint">
            Issuer {hasBit(roles, COLLECTION_ROLE.Issuer) ? "is set" : "is not set"} on the owner.
            Admin {hasBit(roles, COLLECTION_ROLE.Admin) ? "is set" : "is not set"}. Freezer{" "}
            {hasBit(roles, COLLECTION_ROLE.Freezer) ? "is set" : "is not set"}. The issuer can mint
            more while that role remains.
          </p>
        </div>
        <div className="border-t border-line px-4 py-3">
          <p className="text-xs text-muted">Collection metadata</p>
          <p className="mt-1 font-mono text-xs break-all">{profile.metadata ?? "None"}</p>
        </div>
      </Panel>
      <Panel className="lg:col-span-2">
        <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Item</h2>
        <p className="px-4 pt-3 text-sm">
          <Link
            href={`/market?collection=${profile.id}&item=${itemId || "0"}`}
            className="text-blue hover:underline"
          >
            List or buy this item
          </Link>
        </p>
        <form
          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-end"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="block flex-1">
            <span className="text-xs text-muted">Item id</span>
            <input
              className="mt-1.5 h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-sm"
              inputMode="numeric"
              value={itemId}
              onChange={(event) => onItemId(event.target.value)}
            />
          </label>
        </form>
        <MintAnother profile={profile} />
        <div className="px-4 pb-4 text-sm">
          {itemError ? <p className="text-warn">{itemError}</p> : null}
          {!itemId ? <p className="text-muted">Enter an item id to read that item.</p> : null}
          {itemId && item && !item.found ? (
            <p className="text-muted">Item {itemId} is not minted in this collection.</p>
          ) : null}
          {item?.found ? (
            <dl>
              <Row term="Owner" value={item.owner ?? "Unavailable"} mono />
              <div className="py-3">
                <dt className="text-sm text-muted">Item metadata</dt>
                <dd className="mt-1 font-mono text-xs break-all">{item.metadata ?? "None"}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function ItemShortcuts({
  count,
  current,
  onPick,
}: {
  count: string | null;
  current: string;
  onPick: (value: string) => void;
}) {
  const total = count && /^\d+$/.test(count) ? Number(count) : 0;
  if (total <= 0) return null;
  const shown = Math.min(total, 12);
  return (
    <div className="border-t border-line px-4 py-3">
      <p className="text-xs leading-5 text-faint">
        The pallet reports {total} items and does not return their ids. These buttons try the first {shown} ids.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {Array.from({ length: shown }, (_, index) => (
          <button
            key={index}
            type="button"
            className={`rounded-md border px-2 py-1 font-mono text-xs ${
              current === String(index) ? "border-violet text-ink" : "border-line text-muted"
            }`}
            onClick={() => onPick(String(index))}
          >
            Item {index}
          </button>
        ))}
      </div>
    </div>
  );
}

function MintAnother({ profile }: { profile: CollectionProfile }) {
  const chain = useChain();
  const wallet = useSubstrateWallet();
  const txs = useTxs();
  const signer = wallet.selected;
  const [itemId, setItemId] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (signer && to === "") setTo(signer.address);
  }, [signer, to]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!signer) {
      await wallet.connect();
      return;
    }
    const api = chain.getApi();
    const nextItem = Number(itemId.trim());
    if (!api || !/^\d+$/.test(itemId.trim()) || !Number.isSafeInteger(nextItem) || nextItem < 0 || nextItem > 4_294_967_295) {
      setMessage("Item id must be a whole number from 0 to 4294967295.");
      return;
    }
    const destination = to.trim() || signer.address;
    if (!isProceedsAddress(destination)) {
      setMessage("The destination is not a testnet address, so the wallet was not opened.");
      return;
    }
    setBusy(true);
    const id = crypto.randomUUID();
    txs.push({ id, label: `Mint item ${nextItem}`, status: "signing" });
    try {
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injected = await web3FromSource(signer.source);
      if (!injected.signer) throw new Error("This wallet did not provide a signer.");
      const result = await signAndSend(
        api,
        buildMintItem(api, Number(profile.id), nextItem, destination, profile.price),
        signer.address,
        injected.signer,
        (update) => txs.patch(id, update),
      );
      if (result.status === "finalized" || result.status === "included") {
        await chain.refreshCollections().catch(() => undefined);
      }
      setMessage(txResultMessage(result.status, result.error));
    } catch (cause) {
      const outcome = outcomeWithoutHash(errorText(cause));
      txs.patch(id, outcome);
      setMessage(outcome.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3 border-t border-line px-4 py-3" onSubmit={(event) => void onSubmit(event)}>
      <h3 className="text-sm font-medium">Mint another item</h3>
      <p className="text-sm leading-6 text-muted">
        Mint type {profile.mintType ?? "unavailable"}. {profile.price ? `The public price is ${formatUnits(profile.price, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}.` : "No public mint price is set."} An issuer-only collection rejects a signature from another account.
      </p>
      <label className="block text-xs text-muted">
        New item id
        <input className="mt-1.5 h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-sm" value={itemId} onChange={(event) => setItemId(event.target.value)} />
      </label>
      <label className="block text-xs text-muted">
        Mint to
        <input className="mt-1.5 h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-xs" value={to} onChange={(event) => setTo(event.target.value)} spellCheck={false} />
      </label>
      <button type="submit" disabled={busy || chain.status !== "live"} className="rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:opacity-50">
        {busy ? "Waiting for the wallet…" : signer ? "Mint item" : "Connect Substrate wallet"}
      </button>
      {message ? <p className="text-sm leading-6 text-warn">{message}</p> : null}
    </form>
  );
}

function Row({ term, value, mono = false }: { term: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-3 last:border-0">
      <dt className="text-sm text-muted">{term}</dt>
      <dd className={`text-right text-sm break-all ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function Flag({
  label,
  value,
  on,
  off,
}: {
  label: string;
  value: boolean | null;
  on: string;
  off: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {value === null ? (
          <StatusPill tone="warn">Unavailable</StatusPill>
        ) : (
          <StatusPill tone={value ? "ok" : "muted"}>{value ? "On" : "Off"}</StatusPill>
        )}
      </div>
      <p className="mt-1 text-xs leading-5 text-faint">{value === null ? "Not read." : value ? on : off}</p>
    </div>
  );
}
