"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { useProject } from "@/components/project/project-provider";
import { Button, Panel, StatusPill } from "@/components/ui";
import { blankProject, projectError, type CreatorProject } from "@/lib/project";
import { readAssetProfile } from "@/lib/chain-read";
import { readCollectionProfile } from "@/lib/nfts";
import { sameAccount } from "@/lib/withdrawal";
import { mapBounded } from "@/lib/async-map";
import { PROJECT_CATEGORIES, type ProjectCategory } from "@/lib/directory";

export function ImportProject() {
  const chain = useChain(),
    wallet = useSubstrateWallet(),
    stored = useProject();
  const [draft, setDraft] = useState<CreatorProject>({
    ...blankProject(),
    profile: { category: "Other", website: "", example: false },
  });
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [replace, setReplace] = useState(false);
  const [owned, setOwned] = useState<Array<{ id: string; name: string }>>([]),
    [scanned, setScanned] = useState(0);
  const [proof, setProof] = useState<{
    block: string;
    token: string;
    collection: string;
    context: string;
  } | null>(null);
  const context = useRef("");
  context.current = JSON.stringify({
    draft,
    account: wallet.selected?.address,
    local: stored.project?.id,
    revision: stored.project?.revision,
  });
  useEffect(() => {
    setProof(null);
    setOwned([]);
    setScanned(0);
    setStep(0);
    setReplace(false);
  }, [wallet.selected?.address]);
  function update(patch: Partial<CreatorProject>) {
    setDraft((x) => ({ ...x, ...patch }));
    setProof(null);
  }
  async function findOwned() {
    const api = chain.getApi(),
      signer = wallet.selected;
    if (!api || !signer) return;
    const version = wallet.getVersion();
    setBusy(true);
    setNotice("");
    try {
      const candidates = (chain.assets ?? []).slice(scanned, scanned + 40);
      const profiles = await mapBounded(candidates, 4, (asset) =>
        readAssetProfile(api, asset.id),
      );
      if (wallet.getVersion() !== version) return;
      setOwned((old) => [
        ...old,
        ...profiles
          .filter(
            (p) =>
              p.found &&
              (sameAccount(p.owner, signer.address) ||
                sameAccount(p.issuer, signer.address)),
          )
          .map((p) => ({ id: p.id, name: p.name ?? `Token #${p.id}` })),
      ]);
      setScanned(scanned + candidates.length);
      setNotice(
        `Checked ${scanned + candidates.length} loaded tokens for owner or issuer roles. You can also enter an ID directly.`,
      );
    } catch {
      setNotice(
        "Token ownership could not be read. Try again or enter an object ID.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function review() {
    const error = projectError(draft);
    if (error) {
      setNotice(error);
      return;
    }
    if (!draft.assetId && !draft.collectionId && !draft.poolLpToken) {
      setNotice("Link at least one token, collection or pool.");
      return;
    }
    const api = chain.getApi(),
      signer = wallet.selected;
    if (!api || !signer) {
      setNotice("Connect your wallet and wait for the network.");
      return;
    }
    const origin = context.current,
      version = wallet.getVersion();
    setBusy(true);
    setNotice("");
    try {
      const hash = await api.rpc.chain.getFinalizedHead(),
        at = await api.at(hash),
        header = await api.rpc.chain.getHeader(hash);
      const [asset, collection] = await Promise.all([
        draft.assetId
          ? readAssetProfile(at as unknown as typeof api, draft.assetId)
          : null,
        draft.collectionId
          ? readCollectionProfile(
              at as unknown as typeof api,
              draft.collectionId,
            )
          : null,
      ]);
      if (origin !== context.current || version !== wallet.getVersion()) return;
      if (
        (draft.assetId && !asset?.found) ||
        (draft.collectionId && !collection?.found) ||
        (draft.poolLpToken &&
          !chain.pools?.some((p) => p.lpToken === draft.poolLpToken))
      ) {
        setNotice(
          "A linked object was not found in the available snapshot. Check its ID or refresh network discovery.",
        );
        return;
      }
      setProof({
        context: origin,
        block: header.number.toString(),
        token: asset
          ? sameAccount(asset.owner, signer.address)
            ? "Publisher matches the token owner"
            : "Publisher does not match the token owner"
          : "No token linked",
        collection: collection
          ? sameAccount(collection.owner, signer.address)
            ? "Publisher matches the collection owner"
            : "Publisher does not match the collection owner"
          : "No collection linked",
      });
      setStep(2);
    } catch {
      setNotice("The network check failed. Nothing was imported. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (!proof || !wallet.selected || (stored.project && !replace)) return;
    if (proof.context !== context.current) {
      setNotice(
        "The wallet or project changed. Check assets again before importing.",
      );
      setStep(1);
      return;
    }
    const error = await stored.restore({
      ...draft,
      id: crypto.randomUUID(),
      proceeds: wallet.selected.address,
    });
    setNotice(
      error ??
        "Imported into your browser. Open your workspace to save, publish and monitor it.",
    );
    if (!error) setStep(3);
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="product-heading">
        <div>
          <p className="product-eyebrow">Bring an existing project</p>
          <h1>Your assets. One workspace.</h1>
          <p>
            Link assets created anywhere on Portaldot. Importing creates a
            project record and leaves chain ownership unchanged.
          </p>
        </div>
      </section>
      <ol className="flow-steps" aria-label="Import progress">
        {["Connect", "Link assets", "Review"].map((label, i) => (
          <li
            aria-current={step === i ? "step" : undefined}
            className={step >= i ? "is-current" : ""}
            key={label}
          >
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {step === 0 && (
        <Panel className="space-y-5 p-6">
          <h2 className="text-xl font-semibold">
            Connect your publishing wallet
          </h2>
          <p className="text-sm leading-7 text-muted">
            Use a Substrate wallet for Portaldot V3 Testnet. You can browse
            first; linking and checking assets requires no transaction.
          </p>
          {wallet.selected ? (
            <>
              <p className="break-all text-sm text-muted">
                {wallet.selected.address}
              </p>
              <Button onClick={() => setStep(1)}>Continue to assets</Button>
            </>
          ) : (
            <Button onClick={() => void wallet.connect()}>
              Connect wallet
            </Button>
          )}
          <Link className="ml-4 text-sm text-muted underline" href="/network">
            Browse the network
          </Link>
        </Panel>
      )}
      {step === 1 && (
        <Panel className="space-y-5 p-6">
          <h2 className="text-xl font-semibold">Give your project a home</h2>
          <label className="product-field">
            Project name
            <input
              maxLength={48}
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Your project name"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="product-field">
              Category
              <select
                value={draft.profile!.category}
                onChange={(e) =>
                  update({
                    profile: {
                      ...draft.profile!,
                      category: e.target.value as ProjectCategory,
                    },
                  })
                }
              >
                {PROJECT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="product-field">
              Website · optional
              <input
                type="url"
                maxLength={300}
                value={draft.profile!.website}
                placeholder="https://your-project.com"
                onChange={(e) =>
                  update({
                    profile: { ...draft.profile!, website: e.target.value },
                  })
                }
              />
            </label>
          </div>
          <div className="rounded-xl border border-line p-4">
            <h3 className="mb-3 text-sm font-medium">
              Find tokens linked to your wallet
            </h3>
            <Button
              disabled={
                busy ||
                !wallet.selected ||
                chain.status !== "live" ||
                (scanned > 0 && scanned >= (chain.assets?.length ?? 0))
              }
              onClick={() => void findOwned()}
            >
              {busy
                ? "Reading…"
                : scanned
                  ? "Check next loaded tokens"
                  : "Find my tokens"}
            </Button>
            <p className="mt-3 text-xs leading-6 text-muted">
              Reads up to 40 loaded tokens per request. Owner and issuer roles
              are included; discovery coverage may be partial.
            </p>
            {owned.map((x) => (
              <button
                className="mt-3 block text-sm text-violet"
                key={x.id}
                onClick={() => update({ assetId: x.id })}
              >
                Use {x.name} · #{x.id}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["assetId", "Token ID"],
              ["collectionId", "Collection ID"],
              ["poolLpToken", "Pool LP token ID"],
            ].map(([key, label]) => (
              <label className="product-field" key={key}>
                {label}
                <input
                  inputMode="numeric"
                  value={draft[key as "assetId"]}
                  onChange={(e) => update({ [key]: e.target.value })}
                  placeholder="Optional"
                />
              </label>
            ))}
          </div>
          <label className="example-toggle">
            <input
              type="checkbox"
              checked={draft.profile!.example}
              onChange={(e) =>
                update({
                  profile: { ...draft.profile!, example: e.target.checked },
                })
              }
            />{" "}
            This is an example or demonstration project
          </label>
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => void review()}>
              {busy ? "Checking the network…" : "Check assets & review"}
            </Button>
            <Button onClick={() => setStep(0)}>Back</Button>
          </div>
        </Panel>
      )}
      {step === 2 && proof && (
        <Panel className="space-y-5 p-6">
          <StatusPill tone="muted">Finalized block {proof.block}</StatusPill>
          <h2 className="text-2xl font-semibold">{draft.name}</h2>
          <p className="text-sm text-muted">{proof.token}</p>
          <p className="text-sm text-muted">{proof.collection}</p>
          <p className="text-sm leading-7 text-muted">
            Role checks describe the connected account at this block. Linked
            pools do not prove ownership or project revenue. Publishing requires
            a separate signed storage request, and these assets are labelled as
            linked rather than created through Portova.
          </p>
          {stored.project && (
            <label className="example-toggle">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />{" "}
              Replace this browser&apos;s current project draft. Export unsaved
              work first; cloud records and chain assets are unaffected.
            </label>
          )}
          <div className="flex gap-3">
            <Button
              disabled={!wallet.selected || (!!stored.project && !replace)}
              onClick={() => void finish()}
            >
              Import project
            </Button>
            <Button onClick={() => setStep(1)}>Edit details</Button>
          </div>
        </Panel>
      )}
      {step === 3 && (
        <Panel className="space-y-5 p-7">
          <h2 className="text-2xl font-semibold">
            Ready for your next chapter.
          </h2>
          <p className="text-sm leading-7 text-muted">
            Your linked assets are ready. Add a description, save across devices
            and choose whether to publish your project.
          </p>
          <Link
            className="product-primary"
            href="/workspace#project-publishing"
          >
            Open my workspace ↗
          </Link>
        </Panel>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-line p-4 text-sm leading-7 text-muted"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
