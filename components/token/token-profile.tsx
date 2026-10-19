"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChain } from "@/components/chain/chain-provider";
import { PageIntro, Panel, StatusPill } from "@/components/ui";
import { readAssetProfile, type AssetProfile } from "@/lib/chain-read";
import { errorText, formatUnits } from "@/lib/format";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";

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
      {profile?.found ? <ProfileBody profile={profile} /> : null}
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
