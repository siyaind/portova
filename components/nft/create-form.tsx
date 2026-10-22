"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChain } from "@/components/chain/chain-provider";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { PageIntro, Panel } from "@/components/ui";
import { signAndSend } from "@/lib/assets";
import { outcomeWithoutHash, signingLabel, txResultMessage, type TxStatus } from "@/lib/tx-result";
import { byteLength, errorText, formatUnits, parseDecimalToPlanck } from "@/lib/format";
import {
  buildCollectionMintTx,
  byteDeposit,
  createdCollectionUpdate,
  collectionMintSteps,
  predictCollectionId,
  readNftConstants,
  type CollectionMintParams,
  type NftConstants,
} from "@/lib/nfts";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";

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
    predicted !== null &&
    collectionValid &&
    itemValid &&
    itemValidId &&
    supplyValid &&
    priceValid &&
    (priceRaw !== null || !publicMint || price.trim() === "")
      ? {
          admin: signer?.address ?? FEE_ACCOUNT,
          collectionId: predicted,
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
      buildCollectionMintTx(api, params)
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
    if (!api) return;
    const signed = {
      ...params,
      admin: signer.address,
      mintTo: mintTo.trim() || signer.address,
    };
    setSubmitting(true);
    setSubmitPhase("signing");
    let tracked: string | null = null;
    try {
      const current = await predictCollectionId(api);
      if (current !== signed.collectionId) {
        const message = `The next collection id changed to ${current}. Review the form and sign again. Nothing was submitted.`;
        setPredicted(current);
        setFormError(message);
        setSubmitPhase(null);
        return;
      }
      const id = crypto.randomUUID();
      tracked = id;
      txs.push({ id, label: `Create collection ${signed.collectionId}`, status: "signing" });
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injected = await web3FromSource(signer.source);
      if (!injected.signer) throw new Error("This wallet did not provide a signer.");
      const tx = buildCollectionMintTx(api, signed);
      const result = await signAndSend(
        api,
        tx,
        signer.address,
        injected.signer,
        (update) => {
          setSubmitPhase(update.status);
          txs.patch(id, update);
        },
        createdCollectionUpdate,
      );
      if (result.status === "failed") {
        setFormError(result.error ?? "The transaction failed.");
        return;
      }
      if (result.status === "finalized" || result.status === "included") {
        await chain.refreshCollections().catch(() => undefined);
      }
      const collectionId = result.collectionId ?? String(signed.collectionId);
      if (result.status === "finalized") {
        router.push(`/collection/${collectionId}?item=${signed.itemId}`);
        return;
      }
      setFormError(txResultMessage(result.status, result.error));
    } catch (cause) {
      const outcome = outcomeWithoutHash(errorText(cause));
      setFormError(outcome.error);
      setSubmitPhase(outcome.status);
      if (tracked) txs.patch(tracked, outcome);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="NFT launchpad"
        title="Create a collection and mint one item"
        body="One signature sends nfts.create, collection metadata, mint, and optional item metadata as a single batch. If any call fails, none of them are kept. The chain assigns the collection id. You become the owner, issuer, admin, and freezer."
      />
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"
      >
        <Panel className="space-y-4 p-4">
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
          <Field label="Predicted collection id" hint="Assigned by the chain">
            <input className={FIELD} value={predicted === null ? "" : String(predicted)} disabled />
          </Field>
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
            disabled={submitting || chain.status !== "live"}
            className="w-full rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? signingLabel(submitPhase, "Waiting for the wallet…") : signer ? "Create and mint" : "Connect Substrate wallet"}
          </button>
          <p className="text-xs leading-5 text-faint">
            Connecting only reads accounts. The collection batch is a separate signature. Mint
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
              value={fee ? formatUnits(fee, NATIVE_DECIMALS, 6) : feeError ? "Unavailable" : params ? "Estimating…" : "—"}
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
  if (input.predicted === null) problems.push("The next collection id has not loaded.");
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
