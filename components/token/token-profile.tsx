"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChain } from "@/components/chain/chain-provider";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { PageIntro, Panel, StatusPill } from "@/components/ui";
import { buildAssetMint, readAssetConstants, signAndSend } from "@/lib/assets";
import { planck } from "@/lib/balance";
import { reviewExtrinsic } from "@/lib/preflight";
import { readAssetProfile, type AssetProfile } from "@/lib/chain-read";
import { errorText, formatUnits, parseDecimalToPlanck } from "@/lib/format";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import { isProceedsAddress } from "@/lib/project";
import { outcomeWithoutHash, txResultMessage } from "@/lib/tx-result";

export function TokenProfile({ id }: { id: string }) {
  const chain = useChain();
  const [profile, setProfile] = useState<AssetProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!/^\d+$/.test(id)) {
      setProfile(null);
      setError("Asset id must be a whole number.");
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
    void readAssetProfile(api, id)
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

  const title = profile?.found
    ? `${profile.name ?? "Asset"} (${profile.symbol ?? "—"})`
    : `Asset ${id}`;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Token"
        title={title}
        body="Roles, supply, and metadata are read from the Assets pallet. This page does not show a price."
      />
      <p className="text-sm">
        <Link href="/explore" className="text-blue hover:underline">
          Back to explore
        </Link>
      </p>
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {!error && !profile ? (
        <p className="text-sm text-muted">Reading asset {id}…</p>
      ) : null}
      {profile && !profile.found ? (
        <Panel className="p-4">
          <p className="text-sm text-muted">
            No Assets record uses id {id}. A missing asset is not a zero balance.
          </p>
        </Panel>
      ) : null}
      {profile?.found ? (
        <>
          <ProfileBody profile={profile} />
          <MintMore profile={profile} />
        </>
      ) : null}
    </div>
  );
}

function ProfileBody({ profile }: { profile: AssetProfile }) {
  const supply =
    profile.supply !== null && profile.decimals !== null
      ? formatUnits(profile.supply, profile.decimals)
      : "Unavailable";
  const minBalance =
    profile.minBalance !== null && profile.decimals !== null
      ? formatUnits(profile.minBalance, profile.decimals)
      : "Unavailable";
  const deposit =
    profile.deposit !== null ? `${formatUnits(profile.deposit, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}` : "Unavailable";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Supply</h2>
        <dl>
          <Row term="Asset id" value={profile.id} mono />
          <Row term="Status" value={profile.status ?? "Unavailable"} />
          <Row term="Supply" value={supply} mono />
          <Row term="Decimals" value={profile.decimals === null ? "Unavailable" : String(profile.decimals)} mono />
          <Row term="Minimum balance" value={minBalance} mono />
          <Row term="Accounts" value={profile.accounts ?? "Unavailable"} mono />
          <Row term="Class deposit" value={deposit} mono />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-sm text-muted">Frozen</dt>
            <dd>
              {profile.frozen === null ? (
                "Unavailable"
              ) : profile.frozen ? (
                <StatusPill tone="warn">Frozen</StatusPill>
              ) : (
                <StatusPill tone="ok">No</StatusPill>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-sm text-muted">Sufficient</dt>
            <dd className="text-sm">
              {profile.isSufficient === null ? "Unavailable" : profile.isSufficient ? "Yes" : "No"}
            </dd>
          </div>
        </dl>
        <p className="border-t border-line px-4 py-3 text-xs leading-5 text-faint">
          The issuer can mint more while that role is set. This supply figure is the current Assets record.
        </p>
      </Panel>
      <Panel>
        <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Authority</h2>
        <dl>
          <Role term="Owner" value={profile.owner} detail="Can change metadata and destroy the asset." />
          <Role term="Issuer" value={profile.issuer} detail="Can mint more units while this role is set." />
          <Role term="Admin" value={profile.admin} detail="Can burn units and change the team." />
          <Role term="Freezer" value={profile.freezer} detail="Can freeze and thaw accounts." />
        </dl>
      </Panel>
    </div>
  );
}

function MintMore({ profile }: { profile: AssetProfile }) {
  const chain = useChain();
  const wallet = useSubstrateWallet();
  const txs = useTxs();
  const signer = wallet.selected;
  const [amount, setAmount] = useState("");
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
    if (!api || profile.decimals === null) {
      setMessage("Decimals are unavailable, so no mint was signed.");
      return;
    }
    const raw = parseDecimalToPlanck(amount, profile.decimals);
    if (!raw || raw <= BigInt(0)) {
      setMessage("Enter an amount above zero.");
      return;
    }
    const destination = to.trim() || signer.address;
    if (!isProceedsAddress(destination)) {
      setMessage("The destination is not a testnet address, so the wallet was not opened.");
      return;
    }
    setBusy(true);
    const id = crypto.randomUUID();
    try {
      const constants = readAssetConstants(api);
      const hash = (await api.rpc.chain.getFinalizedHead()).toHex();
      if (!constants || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        setMessage("The asset deposit or finalized block could not be read, so the wallet was not opened.");
        return;
      }
      const at = await api.at(hash);
      const stored = (await at.query.assets.account(profile.id, destination)) as unknown as { isNone?: boolean };
      const accountDeposit = stored.isNone ? planck(constants.assetAccountDeposit) : 0n;
      const tx = buildAssetMint(api, Number(profile.id), destination, raw);
      const review = await reviewExtrinsic(api, tx, signer.address, [accountDeposit], hash);
      if (!review.ok) {
        setMessage(review.message);
        return;
      }
      txs.push({ id, label: `Mint asset ${profile.id}`, status: "signing" });
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injected = await web3FromSource(signer.source);
      if (!injected.signer) throw new Error("This wallet did not provide a signer.");
      const result = await signAndSend(
        api,
        review.tx,
        signer.address,
        injected.signer,
        (update) => txs.patch(id, update),
      );
      if (result.status === "finalized" || result.status === "included") await chain.refreshAssets().catch(() => undefined);
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
    <Panel className="space-y-3 p-4">
      <h2 className="text-sm font-medium">Mint more</h2>
      <p className="text-sm leading-6 text-muted">
        This signs assets.mint for the existing id. The issuer can mint more. A signature from another account is rejected by the chain.
      </p>
      <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
        <label className="block text-xs text-muted">
          Amount
          <input className="mt-1.5 h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-sm" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className="block text-xs text-muted">
          Mint to
          <input className="mt-1.5 h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-xs" value={to} onChange={(event) => setTo(event.target.value)} spellCheck={false} />
        </label>
        <button type="submit" disabled={busy || chain.status !== "live"} className="rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:opacity-50">
          {busy ? "Waiting for the wallet…" : signer ? "Mint more" : "Connect Substrate wallet"}
        </button>
      </form>
      {message ? <p className="text-sm leading-6 text-warn">{message}</p> : null}
    </Panel>
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

function Role({ term, value, detail }: { term: string; value: string | null; detail: string }) {
  return (
    <div className="border-b border-line px-4 py-3 last:border-0">
      <dt className="text-sm font-medium">{term}</dt>
      <dd className="mt-1 font-mono text-xs break-all text-ink">{value ?? "Unavailable"}</dd>
      <p className="mt-1 text-xs leading-5 text-faint">{detail}</p>
    </div>
  );
}
