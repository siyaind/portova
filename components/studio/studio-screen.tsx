"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChain } from "@/components/chain/chain-provider";
import { ProceedsBody, useProceedsBalance } from "@/components/project/proceeds-figure";
import { useProject } from "@/components/project/project-provider";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { Button, PageIntro, Panel, StatusPill } from "@/components/ui";
import { readAssetProfile, type AssetProfile } from "@/lib/chain-read";
import { errorText, formatUnits } from "@/lib/format";
import { readTradingEnabled } from "@/lib/market";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import { readCollectionProfile, type CollectionProfile } from "@/lib/nfts";
import { assetDecimals, assetLabel, poolLabel, type PoolView } from "@/lib/pools";
import {
  blankProject,
  linkedIdStage,
  poolStage,
  stageLabel,
  stageTone,
  type CreatorProject,
  type StageKind,
} from "@/lib/project";
const FIELD = "mt-1.5 h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-sm";

type ReadState = "pending" | "ready" | "error";

export function StudioScreen() {
  const chain = useChain();
  const wallet = useSubstrateWallet();
  const stored = useProject();
  const [draft, setDraft] = useState<CreatorProject>(blankProject());
  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"warn" | "muted">("muted");
  const [asset, setAsset] = useState<AssetProfile | null>(null);
  const [assetRead, setAssetRead] = useState<ReadState>("pending");
  const [collection, setCollection] = useState<CollectionProfile | null>(null);
  const [collectionRead, setCollectionRead] = useState<ReadState>("pending");
  const [trading, setTrading] = useState<boolean | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    if (!stored.ready || hydrated) return;
    setDraft(stored.project ?? blankProject());
    setHydrated(true);
  }, [stored.ready, stored.project, hydrated]);

  useEffect(() => {
    const project = stored.project;
    const api = chain.getApi();
    if (!project || chain.status !== "live" || !api) return;
    let cancelled = false;
    setAssetRead(project.assetId ? "pending" : "ready");
    setCollectionRead(project.collectionId ? "pending" : "ready");
    setReadError(null);
    void Promise.all([
      project.assetId ? readAssetProfile(api, project.assetId) : Promise.resolve(null),
      project.collectionId ? readCollectionProfile(api, project.collectionId) : Promise.resolve(null),
    ])
      .then(([nextAsset, nextCollection]) => {
        if (cancelled) return;
        setAsset(nextAsset);
        setCollection(nextCollection);
        setTrading(readTradingEnabled(api));
        setAssetRead("ready");
        setCollectionRead("ready");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setReadError(errorText(cause));
        setAssetRead("error");
        setCollectionRead("error");
      });
    return () => {
      cancelled = true;
    };
  }, [stored.project, chain.status, chain.getApi]);

  function update(patch: Partial<CreatorProject>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);

  }

  function save() {
    const error = stored.save(draft);
    if (error) {
      setNotice(error);
      setNoticeTone("warn");
      return;
    }
    setDirty(false);

    setNotice("Saved in this browser. Nothing was signed.");
    setNoticeTone("muted");
  }

  function clear() {
    stored.clear();
    setDraft(blankProject());
    setDirty(false);

    setNotice("The local project record was removed.");
    setNoticeTone("muted");
  }

  const project = stored.project;
  const symbols = new Map((chain.assets ?? []).map((row) => [row.id, row.symbol]));
  const decimals = new Map(
    (chain.assets ?? []).flatMap((row) => (row.decimals === null ? [] : [[row.id, row.decimals] as const])),
  );
  const assetReady = readFor(project?.assetId ?? "", assetRead, asset?.id);
  const collectionReady = readFor(project?.collectionId ?? "", collectionRead, collection?.id);
  const proceeds = useProceedsBalance(project?.proceeds ?? "");
  const assetKind = project
    ? linkedIdStage(project.assetId, chain.status, assetReady, Boolean(asset?.found && asset.id === project.assetId))
    : "not-started";
  const collectionKind = project
    ? linkedIdStage(
        project.collectionId,
        chain.status,
        collectionReady,
        Boolean(collection?.found && collection.id === project.collectionId),
      )
    : "not-started";
  const poolKind = project ? poolStage(project.poolLpToken, chain.status, chain.pools) : "not-started";
  const matchedPool =
    project && chain.pools
      ? chain.pools.find((pool) => pool.lpToken === project.poolLpToken) ?? null
      : null;
  const saleKind = saleKindFor(project, collectionKind, collection, trading);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Creator studio"
        title="Project workspace"
        body="One local project links an asset, a collection, a pool, and a proceeds account. The link stays in this browser. Token creation, collection minting, liquidity, and listing each keep their own signature on the other pages. Saving here does not transfer sale proceeds into a pool."
      />
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Panel className="space-y-4 p-4">
          <div>
            <h2 className="text-sm font-medium">Project record</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {stored.ready
                ? "This record is off-chain. Clearing it removes only this browser’s copy."
                : "Reading the local project record…"}
            </p>
          </div>
          <label className="block text-xs text-muted">
            Project name
            <input
              className={FIELD}
              value={draft.name}
              maxLength={48}
              onChange={(event) => update({ name: event.target.value })}
            />
          </label>
          <IdField
            label="Asset id"
            value={draft.assetId}
            onChange={(assetId) => update({ assetId })}
            hint={assetHint(chain.assets)}
          />
          {chain.assets && chain.assets.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {chain.assets.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="rounded-md border border-line px-2 py-1 text-xs"
                  onClick={() => update({ assetId: row.id })}
                >
                  {row.symbol} #{row.id}
                </button>
              ))}
            </div>
          ) : null}
          <IdField
            label="Collection id"
            value={draft.collectionId}
            onChange={(collectionId) => update({ collectionId })}
            hint={
              chain.collections === null
                ? "The collection list is unavailable."
                : chain.collections.length === 0
                  ? "No collections are stored on chain."
                  : "Choose a stored collection or enter an id."
            }
          />
          {chain.collections && chain.collections.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {chain.collections.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="rounded-md border border-line px-2 py-1 text-xs"
                  onClick={() => update({ collectionId: row.id })}
                >
                  Collection #{row.id}
                </button>
              ))}
            </div>
          ) : null}
          <IdField
            label="Pool LP token"
            value={draft.poolLpToken}
            onChange={(poolLpToken) => update({ poolLpToken })}
            hint={
              chain.pools === null
                ? "The pool list is unavailable."
                : chain.pools.length === 0
                  ? "AssetConversion.pools has 0 records. An LP token that is absent there is not a pool."
                  : "Choose a stored pool or enter its LP token id."
            }
          />
          {chain.pools && chain.pools.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {chain.pools.map((pool) => (
                <button
                  key={pool.lpToken}
                  type="button"
                  className="rounded-md border border-line px-2 py-1 text-xs"
                  onClick={() => update({ poolLpToken: pool.lpToken })}
                >
                  {poolLabel(pool, symbols)} · LP #{pool.lpToken}
                </button>
              ))}
            </div>
          ) : null}
          <label className="block text-xs text-muted">
            Proceeds account
            <input
              className={`${FIELD} text-xs`}
              value={draft.proceeds}
              spellCheck={false}
              onChange={(event) => update({ proceeds: event.target.value })}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary">
              Save in this browser
            </Button>
            <Button type="button" onClick={clear}>
              Clear project
            </Button>
            <Button
              type="button"
              disabled={!wallet.selected}
              onClick={() => {
                if (!wallet.selected) return;
                update({ proceeds: wallet.selected.address });
              }}
            >
              Use connected account
            </Button>
          </div>
          {!wallet.selected ? (
            <p className="text-xs leading-5 text-faint">
              Connect a Substrate account from the top bar to fill the proceeds field. That button does not sign.
            </p>
          ) : null}
          {dirty ? (
            <p className="text-sm text-muted">The stages below follow the last saved record.</p>
          ) : null}
          {notice ? <p className={`text-sm leading-6 ${noticeTone === "warn" ? "text-warn" : "text-muted"}`}>{notice}</p> : null}
        </Panel>
      </form>
      <Panel>
        <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Stages</h2>
        <ul>
          <Stage label="Identity" kind={project ? "local" : "not-started"}>
            {project
              ? `${project.name} is stored in this browser. The chain has no project object for it.`
              : "No local project is stored."}
          </Stage>
          <Stage label="Token" kind={assetKind}>
            <TokenStage project={project} kind={assetKind} asset={asset} error={readError} />
          </Stage>
          <Stage label="Collection" kind={collectionKind}>
            <CollectionStage project={project} kind={collectionKind} collection={collection} error={readError} />
          </Stage>
          <Stage label="Sale" kind={saleKind}>
            <SaleStage
              project={project}
              kind={saleKind}
              collection={collection}
              trading={trading}
            />
          </Stage>
          <Stage label="Treasury" kind={treasuryKind(proceeds.status)}>
            <ProceedsBody address={project?.proceeds ?? ""} balance={proceeds} />
            <p className="mt-2">
              <Link href="/treasury" className="text-blue hover:underline">
                Treasury page
              </Link>
            </p>
          </Stage>
          <Stage label="Vesting" kind="disabled">
            Creator-token vesting is unavailable. Native vesting covers tPOT only, and this project does not schedule the creator token.
          </Stage>
          <Stage label="Liquidity" kind={poolKind}>
            <PoolStage
              project={project}
              kind={poolKind}
              pool={matchedPool}
              symbols={symbols}
              decimals={decimals}
            />
          </Stage>
          <Stage label="Analytics" kind="disabled">
            No indexer is running, so this project has no chart and no volume.
          </Stage>
          <Stage label="Activity" kind="disabled">
            Project extrinsics are not indexed. Hashes from this browser session stay in the transaction tray, which is not a project history.
          </Stage>
        </ul>
      </Panel>
    </div>
  );
}

function readFor(id: string, read: ReadState, loadedId: string | undefined): ReadState {
  if (read === "error" || !id || loadedId === id) return read;
  return "pending";
}

function saleKindFor(
  project: CreatorProject | null,
  collectionKind: StageKind,
  collection: CollectionProfile | null,
  trading: boolean | null,
): StageKind {
  if (!project?.collectionId) return "not-started";
  if (collectionKind === "reading" || collectionKind === "unavailable" || collectionKind === "missing") {
    return collectionKind;
  }
  if (!collection?.found) return "missing";
  if (trading === null) return "reading";
  if (!trading) return "disabled";
  return "on-chain";
}

function TokenStage({
  project,
  kind,
  asset,
  error,
}: {
  project: CreatorProject | null;
  kind: StageKind;
  asset: AssetProfile | null;
  error: string | null;
}) {
  if (!project?.assetId) return <p>No asset is linked.</p>;
  if (kind === "reading") return <p>Reading Assets for id {project.assetId}.</p>;
  if (kind === "unavailable") return <p>{error ?? "The asset read is unavailable."}</p>;
  if (kind === "missing" || !asset?.found) return <p>No Assets record uses id {project.assetId}.</p>;
  const supply =
    asset.supply && asset.decimals !== null
      ? `${formatUnits(asset.supply, asset.decimals)} ${asset.symbol ?? ""}`.trim()
      : asset.supply
        ? `${asset.supply} raw units`
        : "Supply was not returned.";
  return (
    <div className="space-y-1">
      <p>
        {asset.name ?? "Unnamed"} · {asset.symbol ?? "—"} · #{asset.id}
      </p>
      <p className="font-mono text-xs">Supply {supply}</p>
      <p className="font-mono text-xs break-all">Issuer {asset.issuer ?? "Unavailable"}</p>
      <Link href={`/token/${asset.id}`} className="text-blue hover:underline">
        Open token
      </Link>
    </div>
  );
}

function CollectionStage({
  project,
  kind,
  collection,
  error,
}: {
  project: CreatorProject | null;
  kind: StageKind;
  collection: CollectionProfile | null;
  error: string | null;
}) {
  if (!project?.collectionId) return <p>No collection is linked.</p>;
  if (kind === "reading") return <p>Reading Nfts collection {project.collectionId}.</p>;
  if (kind === "unavailable") return <p>{error ?? "The collection read is unavailable."}</p>;
  if (kind === "missing" || !collection?.found) {
    return (
      <p>
        No Nfts collection uses id {project.collectionId}.{" "}
        <Link href={`/collection/${project.collectionId}`} className="text-blue hover:underline">
          Open collection
        </Link>
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p>Collection #{collection.id}</p>
      <p className="font-mono text-xs break-all">Owner {collection.owner ?? "Unavailable"}</p>
      <p>Items {collection.items ?? "Unavailable"}</p>
      <Link href={`/collection/${collection.id}`} className="text-blue hover:underline">
        Open collection
      </Link>
    </div>
  );
}

function SaleStage({
  project,
  kind,
  collection,
  trading,
}: {
  project: CreatorProject | null;
  kind: StageKind;
  collection: CollectionProfile | null;
  trading: boolean | null;
}) {
  if (!project?.collectionId) return <p>No collection is linked, so there is no sale to read.</p>;
  if (kind === "reading") return <p>Reading mint settings.</p>;
  if (kind === "unavailable") return <p>Mint settings are unavailable until the collection read succeeds.</p>;
  if (kind === "missing") return <p>The linked collection is not on chain, so mint settings are not shown.</p>;
  const price =
    collection?.price && /^\d+$/.test(collection.price)
      ? `${formatUnits(collection.price, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}`
      : "No public mint price is set.";
  return (
    <div className="space-y-1">
      <p>Mint type {collection?.mintType ?? "Unavailable"}.</p>
      <p>Public mint price {price}</p>
      <p>
        {trading
          ? "Secondary sales stay on the marketplace page. This view does not submit them."
          : "Secondary listing stays off while Nfts.Features excludes Trading. This view does not submit set_price or buy_item."}
      </p>
      <Link
        href={`/market?collection=${project.collectionId}&item=0`}
        className="text-blue hover:underline"
      >
        Marketplace
      </Link>
    </div>
  );
}

function PoolStage({
  project,
  kind,
  pool,
  symbols,
  decimals,
}: {
  project: CreatorProject | null;
  kind: StageKind;
  pool: PoolView | null;
  symbols: Map<string, string>;
  decimals: Map<string, number>;
}) {
  if (!project?.poolLpToken) return <p>No pool is linked.</p>;
  if (kind === "reading") return <p>Reading AssetConversion pools.</p>;
  if (kind === "unavailable") {
    return <p>The pool list is unavailable, so LP token {project.poolLpToken} was not treated as a pool.</p>;
  }
  if (kind === "missing" || !pool) {
    return (
      <p>
        AssetConversion.pools has no record for LP token {project.poolLpToken}. Reserves stay unread.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p>
        {poolLabel(pool, symbols)} · LP #{pool.lpToken}
      </p>
      <p>{reserveText("Reserve 1", pool.reserve1, pool.asset1, symbols, decimals)}</p>
      <p>{reserveText("Reserve 2", pool.reserve2, pool.asset2, symbols, decimals)}</p>
      <Link href="/liquidity" className="text-blue hover:underline">
        Liquidity
      </Link>
    </div>
  );
}

function treasuryKind(status: ReturnType<typeof useProceedsBalance>["status"]): StageKind {
  if (status === "empty") return "not-started";
  if (status === "waiting" || status === "reading") return "reading";
  if (status === "ready") return "on-chain";
  return "unavailable";
}

function reserveText(
  label: string,
  amount: string | null,
  asset: PoolView["asset1"],
  symbols: Map<string, string>,
  decimals: Map<string, number>,
): string {
  if (amount === null) return `${label} was not returned.`;
  const places = assetDecimals(asset, decimals);
  if (places === null) return `${label} ${amount} raw`;
  return `${label} ${formatUnits(amount, places)} ${assetLabel(asset, symbols)}`;
}

function Stage({
  label,
  kind,
  children,
}: {
  label: string;
  kind: StageKind;
  children: React.ReactNode;
}) {
  return (
    <li className="border-b border-line px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{label}</h3>
        <StatusPill tone={stageTone(kind)}>{stageLabel(kind)}</StatusPill>
      </div>
      <div className="mt-2 text-sm leading-6 text-muted">{children}</div>
    </li>
  );
}

function IdField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
}) {
  const hintId = `${label.toLowerCase().replace(/\s+/g, "-")}-hint`;
  const inputId = `${hintId}-input`;
  return (
    <div>
      <label className="block text-xs text-muted" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={FIELD}
        inputMode="numeric"
        aria-describedby={hintId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={hintId} className="mt-1 text-xs leading-5 text-faint">
        {hint}
      </p>
    </div>
  );
}

function assetHint(assets: { id: string }[] | null): string {
  if (assets === null) return "The asset list is unavailable. An id can still be saved and checked.";
  if (assets.length === 0) return "No asset metadata records were returned.";
  return "Choose a stored asset or enter an id.";
}
