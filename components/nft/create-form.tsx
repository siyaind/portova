"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChain } from "@/components/chain/chain-provider";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { PageIntro, Panel } from "@/components/ui";
import { useWalletOperation } from "@/components/wallet/use-wallet-operation";
import { outcomeWithoutHash, signingLabel, txResultMessage, type TxStatus } from "@/lib/tx-result";
import { byteLength, errorText, formatUnits, parseDecimalToPlanck } from "@/lib/format";
import {
  buildCollectionCreateTx,
  buildCollectionFinishTx,
  readCollectionProfile,
  byteDeposit,
  createdCollectionUpdate,
  collectionMintSteps,
  predictCollectionId,
  readNftConstants,
  type CollectionMintParams,
  type NftConstants,
} from "@/lib/nfts";
import { planck } from "@/lib/balance";
import { feeHeadroom } from "@/lib/fee-evidence";
import { useCollectionLaunch } from "@/components/nft/use-collection-launch";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import { reviewExtrinsic } from "@/lib/preflight";
import { collectionIdForHash } from "@/lib/tx-reconcile";
import { isProceedsAddress } from "@/lib/project";

const FIELD =
  "h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink placeholder:text-faint";
const FEE_ACCOUNT = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

export function CreateCollectionForm() {
  const chain = useChain();
  const wallet = useSubstrateWallet();
  const txs = useTxs();
  const router = useRouter();
  const signer = wallet.selected;
  const [constants, setConstants] = useState<NftConstants | null>(null);
  const [constantsError, setConstantsError] = useState<string | null>(null);
  const [predicted, setPredicted] = useState<number | null>(null);
  const pending = useCollectionLaunch();
  const launch = pending.launch;
  const createdId = launch?.collectionId ?? null;
  const [collectionUri, setCollectionUri] = useState("");
  const [itemUri, setItemUri] = useState("");
  const [maxSupply, setMaxSupply] = useState("");
  const [itemId, setItemId] = useState("0");
  const [publicMint, setPublicMint] = useState(false);
  const [price, setPrice] = useState("");
  const [transferable, setTransferable] = useState(true);
  const [editableMetadata, setEditableMetadata] = useState(false);
  const [mintTo, setMintTo] = useState("");
  const [fee, setFee] = useState<string | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<TxStatus | null>(null);
  const previousSigner = useRef<string | null>(null);
  const { signAndSend } = useWalletOperation({ collectionUri, itemUri, maxSupply, itemId, publicMint, price, transferable, editableMetadata, mintTo, createdId });

  useEffect(() => {
    if (!signer) return;
    if (mintTo === "" || mintTo === previousSigner.current) setMintTo(signer.address);
    previousSigner.current = signer.address;
  }, [signer, mintTo]);

  useEffect(() => {
    const api = chain.getApi();
    if (chain.status !== "live" || !api) return;
    const next = readNftConstants(api);
    if (!next) {
      setConstants(null);
      setConstantsError("NFT deposit constants are unavailable, so creation stays off.");
      return;
    }
    setConstants(next);
    setConstantsError(null);
    let cancelled = false;
    void predictCollectionId(api).then((id) => {
      if (!cancelled) setPredicted(id);
    });
    return () => {
      cancelled = true;
    };
  }, [chain, chain.status, chain.blockNumber]);

  useEffect(() => {
    if (!launch) return;
    setCollectionUri(launch.settings.collectionMetadata);
    setItemUri(launch.settings.itemMetadata ?? "");
    setItemId(String(launch.settings.itemId));
    setMaxSupply(launch.settings.maxSupply === null ? "" : String(launch.settings.maxSupply));
    setPublicMint(launch.settings.publicMint);
    setPrice(launch.settings.price ?? "");
    setTransferable(launch.settings.transferable);
    setEditableMetadata(launch.settings.metadataEditable);
    setMintTo(launch.settings.mintTo);
  }, [launch?.settings]);

  const limit = constants?.stringLimit ?? 256;
  const collectionBytes = byteLength(collectionUri.trim());
  const itemBytes = byteLength(itemUri.trim());
  const collectionValid = collectionBytes > 0 && collectionBytes <= limit;
  const itemValid = itemUri.trim() === "" || (itemBytes > 0 && itemBytes <= limit);
  const itemNumber = Number(itemId);
  const itemValidId =
    /^\d+$/.test(itemId.trim()) &&
    Number.isSafeInteger(itemNumber) &&
    itemNumber >= 0 &&
    itemNumber <= 4_294_967_295;
  const supplyNumber = maxSupply.trim() === "" ? null : Number(maxSupply.trim());
  const supplyValid =
    supplyNumber === null ||
    (Number.isInteger(supplyNumber) && supplyNumber >= 1 && supplyNumber <= 4_294_967_295);
  const priceRaw = !publicMint || price.trim() === "" ? null : parseDecimalToPlanck(price, NATIVE_DECIMALS);
  const priceValid = !publicMint || price.trim() === "" || priceRaw !== null;
  const mintToValue = mintTo.trim() || signer?.address || "";

  const params: CollectionMintParams | null =
    constants &&
    collectionValid &&
    itemValid &&
    itemValidId &&
    supplyValid &&
    priceValid &&
    (priceRaw !== null || !publicMint || price.trim() === "")
      ? {
          admin: signer?.address ?? FEE_ACCOUNT,
          collectionId: createdId ? Number(createdId) : 0,
          transferable,
          metadataEditable: editableMetadata,
          maxSupply: supplyNumber,
          publicMint,
          price: publicMint ? priceRaw : null,
          collectionMetadata: collectionUri.trim(),
          itemMetadata: itemUri.trim() || null,
          itemId: itemNumber,
          mintTo: mintToValue || FEE_ACCOUNT,
        }
      : null;

  const paramKey = params
    ? [
        params.collectionId,
        params.transferable,
        params.metadataEditable,
        params.maxSupply ?? "",
        params.publicMint,
        params.price?.toString() ?? "",
        params.collectionMetadata,
        params.itemMetadata ?? "",
        params.itemId,
        params.mintTo,
        params.admin,
      ].join("|")
    : "";

  useEffect(() => {
    const api = chain.getApi();
    if (!params || !api) {
      setFee(null);
      return;
    }
    let cancelled = false;
    const payer = signer?.address ?? FEE_ACCOUNT;
    const timer = window.setTimeout(() => {
      (createdId ? buildCollectionFinishTx(api, params) : buildCollectionCreateTx(api, params))
        .paymentInfo(payer)
        .then((info) => {
          if (!cancelled) {
            setFee(info.partialFee.toString());
            setFeeError(null);
          }
        })
        .catch((cause: unknown) => {
          if (!cancelled) {
            setFee(null);
            setFeeError(errorText(cause));
          }
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [paramKey, chain.status, chain.getApi, signer]);

  const deposits = useMemo(() => {
    if (!constants || !collectionValid) return null;
    return {
      collection: constants.collectionDeposit,
      item: constants.itemDeposit,
      collectionMeta: byteDeposit(constants, collectionUri.trim()).toString(),
      itemMeta: itemUri.trim() ? byteDeposit(constants, itemUri.trim()).toString() : null,
    };
  }, [constants, collectionUri, itemUri, collectionValid]);

  const problems = problemsFor({
    chainLive: chain.status === "live",
    constants,
    predicted,
    collectionValid,
    collectionBytes,
    itemValid,
    itemBytes,
    limit,
    itemValidId,
    supplyValid,
    priceValid,
    supplyCoversMint: supplyNumber === null || supplyNumber >= 1,
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!signer) {
      await wallet.connect();
      return;
    }
    if (!params || problems.length > 0) {
      setAttempted(true);
      return;
    }
    const api = chain.getApi();
    if (!api || !constants) return;
    if (!pending.ready || (launch && pending.stage !== "ready-to-finish")) { setFormError("Resolve the saved launch before opening another signature. Use Check saved launch below."); return; }
    const signed = {
      ...params,
      admin: signer.address,
      mintTo: mintTo.trim() || signer.address,
    };
    if (!isProceedsAddress(signed.mintTo)) {
      setFormError("The mint destination is not a testnet address. Nothing was submitted.");
      return;
    }
    setSubmitting(true);
    setSubmitPhase("signing");
    let tracked: string | null = null;
    let signingStarted = false;
    const finishing = createdId !== null && launch !== null;
    try {
      if (finishing) await pending.assertCanFinish();
      const launchSettings = finishing ? launch.settings : {
        collectionMetadata: signed.collectionMetadata,
        itemMetadata: signed.itemMetadata,
        itemId: signed.itemId,
        maxSupply: signed.maxSupply,
        publicMint: signed.publicMint,
        price: price.trim() || null,
        transferable: signed.transferable,
        metadataEditable: signed.metadataEditable,
        mintTo: signed.mintTo,
      };
      const launchParams = {
        ...signed,
        collectionId: finishing ? Number(createdId) : 0,
        collectionMetadata: launchSettings.collectionMetadata,
        itemMetadata: launchSettings.itemMetadata,
        itemId: launchSettings.itemId,
        maxSupply: launchSettings.maxSupply,
        publicMint: launchSettings.publicMint,
        price: launchSettings.publicMint && launchSettings.price ? parseDecimalToPlanck(launchSettings.price, NATIVE_DECIMALS) : null,
        transferable: launchSettings.transferable,
        metadataEditable: launchSettings.metadataEditable,
        mintTo: launchSettings.mintTo,
      };
      const createDebits = [planck(constants.collectionDeposit)];
      const finishDebits = [
        planck(constants.itemDeposit),
        byteDeposit(constants, launchParams.collectionMetadata),
        launchParams.itemMetadata ? byteDeposit(constants, launchParams.itemMetadata) : 0n,
        launchParams.price ?? 0n,
      ];
      const tx = finishing ? buildCollectionFinishTx(api, launchParams) : buildCollectionCreateTx(api, launchParams);
      if (!finishing) {
        const finishQuote = buildCollectionFinishTx(api, launchParams);
        const createReview = await reviewExtrinsic(api, tx, signer.address, createDebits);
        const finishReview = await reviewExtrinsic(api, finishQuote, signer.address, finishDebits);
        if (!createReview.ok) {
          setFormError(createReview.message);
          setSubmitPhase(null);
          return;
        }
        if (!finishReview.ok) {
          setFormError(`The metadata and mint signature was checked before the create. ${finishReview.message}`);
          setSubmitPhase(null);
          return;
        }
        const room = feeHeadroom(createReview.spendable, createReview.nativeNeed + finishReview.nativeNeed, createReview.fee - createReview.estimatedFee + finishReview.fee - finishReview.estimatedFee);
        if (room !== "ok") {
          setFormError("The two signatures together leave insufficient policy headroom beyond their estimates and deposits. The first signature was not opened.");
          setSubmitPhase(null);
          return;
        }
      }
      const review = await reviewExtrinsic(api, tx, signer.address, finishing ? finishDebits : createDebits);
      if (!review.ok) {
        setFormError(review.message);
        setSubmitPhase(null);
        return;
      }
      if (!finishing) pending.begin(launchSettings);
      const id = crypto.randomUUID();
      tracked = id;
      txs.push({ id, label: finishing ? `Finish collection ${signed.collectionId}` : "Create collection", status: "signing" });
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injected = await web3FromSource(signer.source);
      if (!injected.signer) throw new Error("This wallet did not provide a signer.");
      signingStarted = true;
      const result = await signAndSend(
        api,
        review.tx,
        signer.address,
        injected.signer,
        (update) => {
          setSubmitPhase(update.status);
          txs.patch(id, update);
          pending.update(finishing ? "finish" : "create", update);
        },
        finishing ? undefined : createdCollectionUpdate,
        finishing ? async () => { await pending.assertCanFinish(); return true; } : undefined,
      );
      if (result.status === "failed") {
        setFormError(result.error ?? "The transaction failed.");
        return;
      }
      if (result.status === "finalized" || result.status === "included") {
        await chain.refreshCollections().catch(() => undefined);
      }
      if (!finishing) {
        const recovered = result.collectionId ?? (result.hash ? await collectionIdForHash(api, result.hash) : null);
        if ((result.status !== "finalized" && result.status !== "included") || !recovered) {
          setFormError(result.status === "finalized"
            ? "The create was finalized, but its nfts.Created id was not found. The app will not guess one or start another collection."
            : txResultMessage(result.status, result.error));
          return;
        }
        pending.update("create", { ...result, collectionId: recovered });
        setFormError(`Collection ${recovered} is on chain for this wallet. Sign once more to add the saved metadata and mint.`);
        return;
      }
      if (result.status === "finalized") {
        router.push(`/collection/${launchParams.collectionId}?item=${launchParams.itemId}`);
        return;
      }
      setFormError(txResultMessage(result.status, result.error));
    } catch (cause) {
      const outcome = { ...outcomeWithoutHash(errorText(cause)), ...(!signingStarted || (cause as { notBroadcast?: boolean })?.notBroadcast ? { notBroadcast: true } : {}) };
      setFormError(outcome.error);
      setSubmitPhase(outcome.status);
      if (tracked) txs.patch(tracked, outcome);
      if (tracked) pending.update(finishing ? "finish" : "create", outcome);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="NFT launchpad"
        title="Create a world worth owning."
        body="Launch in two signatures: first create the collection, then add metadata and mint its first item. Your progress is saved for this wallet, so you can resume either step after reloading."
      />
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"
      >
        <Panel className="space-y-4 p-4">
          <fieldset disabled={Boolean(launch) || submitting} className="min-w-0 space-y-4 border-0 p-0">
          <Field label="Collection metadata URI" hint={`${collectionBytes}/${limit} bytes`}>
            <input
              className={FIELD}
              value={collectionUri}
              placeholder="ipfs://… or https://…"
              onChange={(event) => setCollectionUri(event.target.value)}
              required
            />
          </Field>
          <p className="text-xs leading-5 text-faint">
            This pallet has no collection name. The metadata URI is the on-chain identity.
          </p>
          <Field label="Item metadata URI" hint={itemUri.trim() ? `${itemBytes}/${limit} bytes` : "Optional"}>
            <input
              className={FIELD}
              value={itemUri}
              placeholder="Leave blank to mint without item metadata"
              onChange={(event) => setItemUri(event.target.value)}
            />
          </Field>
          <p className="text-xs leading-5 text-faint">
            PORTOVA stores this text on chain. It does not upload or pin the file behind the URI.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Item id" hint="Chosen by you">
              <input className={FIELD} inputMode="numeric" value={itemId} onChange={(event) => setItemId(event.target.value)} />
            </Field>
            <Field label="Max supply" hint="Blank means no cap">
              <input className={FIELD} inputMode="numeric" value={maxSupply} onChange={(event) => setMaxSupply(event.target.value)} />
            </Field>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={transferable} onChange={(event) => setTransferable(event.target.checked)} />
            <span>Items can be transferred. Turn this off and the item stays with its owner.</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={editableMetadata}
              onChange={(event) => setEditableMetadata(event.target.checked)}
            />
            <span>
              Metadata can be changed later. Leave this off and the URI written here cannot be edited.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={publicMint} onChange={(event) => setPublicMint(event.target.checked)} />
            <span>Public mint. Any account can mint until the supply cap. There is no per-wallet limit in this pallet.</span>
          </label>
          <Field label={`Public mint price (${NATIVE_SYMBOL})`} hint={publicMint ? "Blank means free" : "Only used for public mint"}>
            <input
              className={FIELD}
              inputMode="decimal"
              value={price}
              disabled={!publicMint}
              onChange={(event) => setPrice(event.target.value)}
            />
          </Field>
          <Field label="Mint to" hint="Defaults to the signing account">
            <input className={`${FIELD} font-mono text-xs`} value={mintTo} onChange={(event) => setMintTo(event.target.value)} spellCheck={false} />
          </Field>
          <Field label={createdId ? "Created collection id" : "Next collection id"} hint="Not used inside the create call">
            <input className={FIELD} value={createdId ?? (predicted === null ? "" : String(predicted))} disabled />
          </Field>
          <p className="text-xs leading-5 text-faint">
            {createdId
              ? `Collection ${createdId} is already on chain. The next signature writes metadata and mints item ${itemId} on that id.`
              : "The first signature only creates the collection. The chain assigns the id. Metadata and the first mint are a second signature after that id is known."}
          </p>
          </fieldset>
          {launch || pending.hasInvalidCheckpoint ? (
            <button
              type="button"
              className="text-xs text-muted underline"
              onClick={() => {
                if (!pending.clear()) return;
                setFormError("The unfinished launch was cleared in this browser. The collection on chain was not removed.");
              }}
            >
              {pending.stage === "complete" ? "Start another collection" : "Clear this browser checkpoint"}
            </button>
          ) : null}
          <ol className="grid grid-cols-2 gap-2 text-xs"><li className={`rounded-lg border p-3 ${createdId ? "border-ok text-ok" : "border-violet text-violet"}`}>1. Create collection{createdId ? ` · #${createdId}` : ""}</li><li className={`rounded-lg border p-3 ${pending.stage === "complete" ? "border-ok text-ok" : "border-line text-muted"}`}>2. Add metadata & mint{pending.stage === "complete" ? " · Finalized" : ""}</li></ol>
          {launch && <div className="space-y-2 text-xs text-muted"><p>Saved launch: {pending.stage.replaceAll("-", " ")}. {launch.createHash ? `Create receipt ${launch.createHash}` : "No create hash returned; check your wallet before starting another launch."}</p><button type="button" className="text-violet" disabled={pending.checking} onClick={() => void pending.recover()}>{pending.checking ? "Checking chain…" : "Check saved launch"}</button>{createdId && <a href={`/collection/${createdId}`} className="ml-3 text-violet">Open collection</a>}</div>}
          {pending.error && <p role="alert" className="text-xs text-warn">{pending.error}</p>}
          {attempted && problems.length > 0 ? (
            <ul className="space-y-1 text-sm text-warn">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
          {chain.status === "unavailable" ? (
            <p className="text-sm leading-6 text-warn">{chain.error ?? "The testnet connection is unavailable."}</p>
          ) : null}
          {wallet.error ? <p className="text-sm leading-6 text-warn">{wallet.error}</p> : null}
          {formError ? <p className="text-sm leading-6 text-warn">{formError}</p> : null}
          <button
            type="submit"
            disabled={submitting || chain.status !== "live" || (signer !== null && (!pending.ready || (launch !== null && pending.stage !== "ready-to-finish")))}
            className="w-full rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? signingLabel(submitPhase, "Waiting for the wallet…") : signer ? (createdId ? "Add metadata and mint" : "Create collection") : "Connect Substrate wallet"}
          </button>
          <p className="text-xs leading-5 text-faint">
            Connecting only reads accounts. Create and the metadata mint are separate signatures. Mint
            proceeds are not moved into a pool.
          </p>
        </Panel>
        <Panel className="space-y-4 p-4">
          <h2 className="text-sm font-medium">What will be signed</h2>
          <ol className="list-decimal space-y-2 pl-4 text-sm text-muted">
            {collectionMintSteps({
              transferable,
              metadataEditable: editableMetadata,
              lockMaxSupply: supplyNumber !== null && supplyValid,
              hasItemMetadata: itemUri.trim().length > 0,
            }).map((step) => (
              <li key={step.call}>{mintStepLabel(step.call)}</li>
            ))}
          </ol>
          <p className="text-sm leading-6 text-muted">
            Wrapped in utility.batchAll. Collection and item metadata are written while they are still
            editable. {editableMetadata ? "Metadata stays editable." : "Metadata is locked after those writes, in the same batch."}{" "}
            DepositRequired stays clear, so the ordinary create call still reserves the collection deposit.{" "}
            {transferable ? "Items can be transferred." : "Items cannot be transferred."}{" "}
            {supplyNumber !== null ? "The max supply is locked." : "No max supply is set."}{" "}
            {publicMint ? "Minting is public." : "Only the issuer can mint."}
          </p>
          <dl className="space-y-3 text-sm">
            <Preview term={`Collection deposit (${NATIVE_SYMBOL})`} value={show(deposits?.collection)} />
            <Preview term={`Item deposit (${NATIVE_SYMBOL})`} value={show(deposits?.item)} />
            <Preview term={`Collection metadata deposit (${NATIVE_SYMBOL})`} value={show(deposits?.collectionMeta)} />
            <Preview
              term={`Item metadata deposit (${NATIVE_SYMBOL})`}
              value={deposits?.itemMeta ? formatUnits(deposits.itemMeta, NATIVE_DECIMALS) : itemUri.trim() ? "Unavailable" : "Not set"}
            />
            <Preview
              term={`Estimated fee (${NATIVE_SYMBOL})`}
              value={
                fee
                  ? `${formatUnits(fee, NATIVE_DECIMALS, 6)} ${NATIVE_SYMBOL}`
                  : feeError
                    ? "Unavailable"
                    : params
                      ? "Estimating…"
                      : "—"
              }
            />
          </dl>
          {feeError ? <p className="text-xs leading-5 text-warn">{feeError}</p> : null}
          {constantsError ? <p className="text-xs leading-5 text-warn">{constantsError}</p> : null}
          <p className="text-xs leading-5 text-faint">
            Deposits are reserved from the signer. A public price, if set, is paid in {NATIVE_SYMBOL} to
            the collection owner. There is no per-wallet mint cap.
          </p>
        </Panel>
      </form>
    </div>
  );
}

function mintStepLabel(call: string): string {
  if (call === "create") return "nfts.create";
  if (call === "setCollectionMetadata") return "nfts.setCollectionMetadata";
  if (call === "mint") return "nfts.mint";
  if (call === "setItemMetadata") return "nfts.setMetadata";
  if (call === "lockCollection") return "nfts.lockCollection";
  return "nfts.lockItemProperties";
}

function show(value: string | null | undefined): string {
  return value ? formatUnits(value, NATIVE_DECIMALS) : "Unavailable";
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-xs text-muted">
        <span>{label}</span>
        <span className="text-faint">{hint}</span>
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function Preview({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{term}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

function problemsFor(input: {
  chainLive: boolean;
  constants: NftConstants | null;
  predicted: number | null;
  collectionValid: boolean;
  collectionBytes: number;
  itemValid: boolean;
  itemBytes: number;
  limit: number;
  itemValidId: boolean;
  supplyValid: boolean;
  priceValid: boolean;
  supplyCoversMint: boolean;
}): string[] {
  const problems: string[] = [];
  if (!input.chainLive) problems.push("The testnet connection is not ready.");
  if (!input.constants) problems.push("Deposit constants have not loaded.");
  if (!input.collectionValid) {
    problems.push(`Collection metadata must be 1 to ${input.limit} bytes. This one is ${input.collectionBytes}.`);
  }
  if (!input.itemValid) {
    problems.push(`Item metadata must be 1 to ${input.limit} bytes. This one is ${input.itemBytes}.`);
  }
  if (!input.itemValidId) problems.push("Item id must be an integer from 0 to 4294967295.");
  if (!input.supplyValid) problems.push("Max supply must be blank or an integer from 1 to 4294967295.");
  if (!input.supplyCoversMint) problems.push("Max supply must be at least 1 because this transaction mints one item.");
  if (!input.priceValid) problems.push(`Mint price must be a ${NATIVE_SYMBOL} amount with at most 14 decimals.`);
  return problems;
}
