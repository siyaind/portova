"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChain } from "@/components/chain/chain-provider";
import { useProject } from "@/components/project/project-provider";
import { ProceedsFigure } from "@/components/project/proceeds-figure";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { PageIntro, Panel, StatusPill } from "@/components/ui";
import {
  assetIdTaken,
  buildCreateMintTx,
  metadataDeposit,
  readAssetConstants,
  signAndSend,
  type TxUpdate,
} from "@/lib/assets";
import { planck } from "@/lib/balance";
import { readAssetMinBalance } from "@/lib/chain-read";
import { errorText, formatUnits, parseDecimalToPlanck } from "@/lib/format";
import { readTradingEnabled } from "@/lib/market";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import {
  buildCollectionCreateTx,
  buildCollectionFinishTx,
  byteDeposit,
  createdCollectionUpdate,
  predictCollectionId,
  readNftConstants,
} from "@/lib/nfts";
import { applySlippage, assetDecimals, balanceDigits, buildAddLiquidity, buildCreatePool, buildSwapExactIn, missingLpAccountDeposit, quoteForSwap, readPoolConstants, readPoolPosition, readPools, reservePaysSwap, sameAsset, type AssetRef, type PoolView } from "@/lib/pools";
import { optimalDeposit } from "@/lib/liquidity-math";
import { reviewExtrinsic } from "@/lib/preflight";
import { depositStillExecutable, swapStillExecutable } from "@/lib/quote-window";
import { parseRun, rememberEvidence, type RunEvidence, type RunStepName } from "@/lib/testnet-run";
import { outcomeWithoutHash, txResultMessage, type TxStatus } from "@/lib/tx-result";

const FIELD = "mt-1.5 h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-sm";
const STORAGE_KEY = "portova.testnet-run.v1";

export function RunScreen() {
  const chain = useChain();
  const wallet = useSubstrateWallet();
  const txs = useTxs();
  const project = useProject();
  const signer = wallet.selected;
  const busyRef = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<RunEvidence[]>([]);
  const [ready, setReady] = useState(false);
  const [trading, setTrading] = useState<boolean | null>(null);
  const [assetId, setAssetId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [tokenName, setTokenName] = useState("Portova run");
  const [tokenSymbol, setTokenSymbol] = useState("RUN");
  const [collectionUri, setCollectionUri] = useState("ipfs://portova/run");
  const [nativeAmount, setNativeAmount] = useState("1");
  const [tokenAmount, setTokenAmount] = useState("100");
  const [swapAmount, setSwapAmount] = useState("0.1");
  const [swapPreview, setSwapPreview] = useState<{ key: string; out: string; minimum: string } | null>(null);
  const [swapPreviewState, setSwapPreviewState] = useState<"idle" | "reading" | "ready" | "none">("idle");
  const [assetReady, setAssetReady] = useState(false);

  useEffect(() => {
    setEvidence(parseRun(window.localStorage.getItem(STORAGE_KEY)));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(evidence));
  }, [evidence, ready]);

  useEffect(() => {
    const api = chain.getApi();
    if (chain.status !== "live" || !api) return;
    setTrading(readTradingEnabled(api));
    if (!collectionId) {
      void predictCollectionId(api).then((id) => setCollectionId(String(id))).catch(() => undefined);
    }
  }, [chain.status, chain.getApi, collectionId]);

  const [suggestAsset, setSuggestAsset] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("portova.testnet-run.asset.v1");
    if (saved && /^\d+$/.test(saved)) setAssetId(saved);
    setSuggestAsset(true);
  }, []);

  useEffect(() => {
    if (/^\d+$/.test(assetId)) window.sessionStorage.setItem("portova.testnet-run.asset.v1", assetId);
  }, [assetId]);

  useEffect(() => {
    if (!suggestAsset || assetId || !chain.assets) return;
    const ids = chain.assets.map((asset) => Number(asset.id)).filter((id) => Number.isInteger(id) && id >= 0);
    setAssetId(String(ids.length === 0 ? 1 : Math.max(...ids) + 1));
  }, [suggestAsset, assetId, chain.assets]);

  useEffect(() => {
    const api = chain.getApi();
    const id = Number(assetId.trim());
    if (chain.status !== "live" || !api || !Number.isInteger(id) || id < 0) {
      setAssetReady(false);
      return;
    }
    let cancelled = false;
    setAssetReady(false);
    void assetIdTaken(api, id)
      .then((taken) => {
        if (!cancelled) setAssetReady(taken);
      })
      .catch(() => {
        if (!cancelled) setAssetReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, chain.status, chain.getApi, chain.assets]);

  const pool = findNativePool(chain.pools, assetId);
  const swapReceive = pool ? (pool.asset1.kind === "native" ? pool.asset2 : pool.asset1) : null;
  const swapPreviewKey = pool && swapReceive ? `${pool.lpToken}|${pool.reserve1 ?? ""}|${pool.reserve2 ?? ""}|${swapAmount}` : "";

  useEffect(() => {
    const api = chain.getApi();
    const amount = parseDecimalToPlanck(swapAmount, NATIVE_DECIMALS);
    if (chain.status !== "live" || !api || !pool || !swapReceive || !swapPreviewKey || !amount || amount <= BigInt(0)) {
      setSwapPreview(null);
      setSwapPreviewState(pool ? "idle" : "none");
      return;
    }
    let cancelled = false;
    setSwapPreviewState("reading");
    const timer = window.setTimeout(() => {
      const receive = swapReceive;
      void quoteForSwap(api, { kind: "native" }, receive, amount)
        .then((priced) => {
          if (cancelled) return;
          const minimum = priced && /^[1-9]\d*$/.test(priced.amount) ? applySlippage(BigInt(priced.amount), "0.5") : null;
          if (!priced || minimum === null || minimum <= BigInt(0)) {
            setSwapPreview(null);
            setSwapPreviewState("none");
            return;
          }
          setSwapPreview({ key: swapPreviewKey, out: priced.amount, minimum: minimum.toString() });
          setSwapPreviewState("ready");
        })
        .catch(() => {
          if (!cancelled) {
            setSwapPreview(null);
            setSwapPreviewState("none");
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [chain.status, chain.getApi, pool, swapReceive, swapPreviewKey, swapAmount]);
  const liveApi = chain.getApi();
  const setupFee = chain.status === "live" && liveApi ? readPoolConstants(liveApi) : null;

  function record(step: RunStepName, label: string, result: TxUpdate, refId?: string) {
    setEvidence((current) =>
      rememberEvidence(current, {
        step,
        label,
        status: result.status,
        hash: result.hash,
        error: result.error,
        refId,
      }),
    );
    const sentence = txResultMessage(result.status, result.error);
    setNotice(result.hash ? `${sentence} ${result.hash}` : sentence);
  }

  async function sign(
    label: string,
    tx: Parameters<typeof signAndSend>[1] & {
      paymentInfo: (payer: string) => Promise<{ partialFee: { toString(): string } }>;
    },
    nativeDebits: Array<bigint | null>,
    decorate?: Parameters<typeof signAndSend>[5],
    blockHash?: string,
    stillCurrent?: () => Promise<boolean>,
    buttonLabel?: string,
  ): Promise<TxUpdate | null> {
    if (!signer) {
      await wallet.connect();
      return null;
    }
    const api = chain.getApi();
    if (!api) {
      setNotice("The testnet connection is unavailable.");
      return null;
    }
    const review = await reviewExtrinsic(api, tx, signer.address, nativeDebits, blockHash);
    if (!review.ok) {
      setNotice(review.message);
      return null;
    }
    if (stillCurrent) {
      try {
        if (!(await stillCurrent())) {
          setNotice("The chain moved after the fee check. Nothing was submitted.");
          return null;
        }
      } catch (cause) {
        setNotice(errorText(cause));
        return null;
      }
    }
    setBusy(buttonLabel ?? label);
    const id = crypto.randomUUID();
    txs.push({ id, label, status: "signing" });
    try {
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injected = await web3FromSource(signer.source);
      if (!injected.signer) throw new Error("This wallet did not provide a signer.");
      return await signAndSend(
        api,
        review.tx,
        signer.address,
        injected.signer,
        (update) => txs.patch(id, update),
        decorate,
        stillCurrent,
      );
    } catch (cause) {
      const text = errorText(cause);
      const failed = outcomeWithoutHash(text);
      txs.patch(id, failed);
      setNotice(failed.error);
      return failed;
    } finally {
      setBusy(null);
    }
  }

  async function runLocked(body: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await body();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function createToken() {
    if (!signer) {
      await wallet.connect();
      return;
    }
    const api = chain.getApi();
    if (!api) {
      setNotice("The testnet connection is unavailable.");
      return;
    }
    const constants = readAssetConstants(api);
    const id = Number(assetId);
    const supply = parseDecimalToPlanck("1000", 18);
    const minBalance = parseDecimalToPlanck("1", 18);
    if (!constants || !Number.isInteger(id) || !supply || !minBalance) {
      setNotice("Asset constants or the asset id are not ready, so nothing was signed.");
      return;
    }
    if (await assetIdTaken(api, id)) {
      setNotice(`Asset id ${id} is already on chain. Choose another id.`);
      return;
    }
    const tx = buildCreateMintTx(api, {
      id,
      admin: signer.address,
      minBalance,
      name: tokenName.trim(),
      symbol: tokenSymbol.trim(),
      decimals: 18,
      beneficiary: signer.address,
      supply,
    });
    const result = await sign(`Create asset ${id}`, tx, [
      planck(constants.assetDeposit),
      metadataDeposit(constants, tokenName.trim(), tokenSymbol.trim()),
      planck(constants.assetAccountDeposit),
    ], undefined, undefined, undefined, "Sign token");
    if (!result) return;
    record("token", `Create asset ${id}`, result, result.status === "finalized" ? String(id) : undefined);
    if (result.status === "finalized" || result.status === "included") await chain.refreshAssets().catch(() => undefined);
    if (result.status === "finalized") linkProject({ assetId: String(id) });
  }

  async function createNft() {
    if (!signer) {
      await wallet.connect();
      return;
    }
    const api = chain.getApi();
    if (!api) {
      setNotice("The testnet connection is unavailable.");
      return;
    }
    const constants = readNftConstants(api);
    if (!constants || !collectionUri.trim()) {
      setNotice("Collection constants are not ready, so nothing was signed.");
      return;
    }
    const itemMetadata = "ipfs://portova/run-item";
    const draft = {
      admin: signer.address,
      collectionId: 0,
      transferable: true,
      metadataEditable: false,
      maxSupply: 1,
      publicMint: false,
      price: null,
      collectionMetadata: collectionUri.trim(),
      itemMetadata,
      itemId: 0,
      mintTo: signer.address,
    };
    const created = await sign(
      "Create collection",
      buildCollectionCreateTx(api, draft),
      [planck(constants.collectionDeposit)],
      createdCollectionUpdate,
      undefined,
      undefined,
      "Sign NFT",
    );
    if (!created) return;
    const confirmed = created.collectionId && created.status === "finalized" ? created.collectionId : undefined;
    record("nft", "Create collection", created, confirmed);
    if (!confirmed) {
      setNotice(created.status === "finalized"
        ? "The create was finalized, but the Created event did not include an id. Metadata was not submitted."
        : txResultMessage(created.status, created.error));
      return;
    }
    setCollectionId(confirmed);
    linkProject({ collectionId: confirmed });
    const finished = await sign(
      `Finish collection ${confirmed}`,
      buildCollectionFinishTx(api, { ...draft, collectionId: Number(confirmed) }),
      [
        planck(constants.itemDeposit),
        byteDeposit(constants, collectionUri.trim()),
        byteDeposit(constants, itemMetadata),
        0n,
      ],
      undefined,
      undefined,
      undefined,
      "Sign NFT",
    );
    if (!finished) return;
    record("nft", `Finish collection ${confirmed}`, finished, confirmed);
    if (finished.status === "finalized" || finished.status === "included") await chain.refreshCollections().catch(() => undefined);
  }

  async function createPool() {
    if (!signer || !assetId) {
      setNotice("Choose the asset id before creating a pool.");
      return;
    }
    const left: AssetRef = { kind: "native" };
    const right: AssetRef = { kind: "asset", id: assetId };
    if (sameAsset(left, right)) return;
    const api = chain.getApi();
    if (!api) {
      setNotice("The testnet connection is unavailable.");
      return;
    }
    const poolConstants = readPoolConstants(api);
    const setup = poolConstants && /native/i.test(poolConstants.poolSetupFeeAsset) ? planck(poolConstants.poolSetupFee) : null;
    const tx = buildCreatePool(api, left, right);
    if (!findNativePool(chain.pools, assetId) && !assetReady) {
      setNotice("Create the asset before opening a pool for it.");
      return;
    }
    const result = await sign(`Create pool ${NATIVE_SYMBOL}/${assetId}`, tx, [setup], undefined, undefined, undefined, "Sign pool");
    if (!result) return;
    let label = `Create pool ${NATIVE_SYMBOL}/${assetId}`;
    let refId: string | undefined;
    if (result.status === "finalized" || result.status === "included") {
      await chain.refreshPools().catch(() => undefined);
      const nextApi = chain.getApi();
      const pools = nextApi ? await readPools(nextApi).catch(() => []) : [];
      const created = findNativePool(pools, assetId);
      if (created) {
        label = `Create pool ${NATIVE_SYMBOL}/${assetId} LP ${created.lpToken}`;
        refId = created.lpToken;
        if (result.status === "finalized") linkProject({ poolLpToken: created.lpToken });
      }
    }
    record("pool", label, result, refId);
  }

  async function addLiquidity() {
    if (busyRef.current) return;
    if (!signer || !pool) {
      setNotice("Add liquidity after the pool is stored on chain.");
      return;
    }
    busyRef.current = true;
    try {
    const decimals = new Map((chain.assets ?? []).flatMap((asset) => (asset.decimals === null ? [] : [[asset.id, asset.decimals] as const])));
    const leftDecimals = assetDecimals(pool.asset1, decimals);
    const rightDecimals = assetDecimals(pool.asset2, decimals);
    if (leftDecimals === null || rightDecimals === null) {
      setNotice("Asset decimals are unavailable, so no liquidity transaction was built.");
      return;
    }
    const desired1 = parseDecimalToPlanck(pool.asset1.kind === "native" ? nativeAmount : tokenAmount, leftDecimals);
    const desired2 = parseDecimalToPlanck(pool.asset2.kind === "native" ? nativeAmount : tokenAmount, rightDecimals);
    if (!desired1 || !desired2) {
      setNotice("Enter liquidity amounts before signing.");
      return;
    }
    const api = chain.getApi();
    if (!api) {
      setNotice("The testnet connection is unavailable.");
      return;
    }
    const position = await readPoolPosition(api, pool.asset1, pool.asset2, pool.lpToken);
    const reserve1 = position.reserve1 && /^\d+$/.test(position.reserve1) ? BigInt(position.reserve1) : null;
    const reserve2 = position.reserve2 && /^\d+$/.test(position.reserve2) ? BigInt(position.reserve2) : null;
    const deposit = optimalDeposit(desired1, desired2, reserve1, reserve2);
    const min1 = deposit ? applySlippage(deposit.amount1, "0.5") : null;
    const min2 = deposit ? applySlippage(deposit.amount2, "0.5") : null;
    if (!deposit || !min1 || !min2 || min1 <= BigInt(0) || min2 <= BigInt(0)) {
      setNotice("The reserve ratio does not produce a deposit above zero, so nothing was signed.");
      return;
    }
    const nativeIn = pool.asset1.kind === "native" ? deposit.amount1 : pool.asset2.kind === "native" ? deposit.amount2 : 0n;
    const lpDeposit = await missingLpAccountDeposit(api, pool.lpToken, signer.address, position.blockHash);
    const tx = buildAddLiquidity(api, pool, deposit.amount1, deposit.amount2, min1, min2, signer.address);
    const result = await sign(
      `Add liquidity LP ${pool.lpToken}`,
      tx,
      [nativeIn, lpDeposit],
      undefined,
      position.blockHash,
      async () => {
        const next = await readPoolPosition(api, pool.asset1, pool.asset2, pool.lpToken);
        const nextReserve1 = next.reserve1 && /^\d+$/.test(next.reserve1) ? BigInt(next.reserve1) : null;
        const nextReserve2 = next.reserve2 && /^\d+$/.test(next.reserve2) ? BigInt(next.reserve2) : null;
        return depositStillExecutable(deposit.amount1, deposit.amount2, min1, min2, nextReserve1, nextReserve2);
      },
      "Sign liquidity",
    );
    if (!result) return;
    record("liquidity", `Add liquidity LP ${pool.lpToken}`, result, result.status === "finalized" ? pool.lpToken : undefined);
    if (result.status === "finalized" || result.status === "included") void chain.refreshPools().catch(() => undefined);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function swap() {
    if (busyRef.current) return;
    if (!signer) {
      await wallet.connect();
      return;
    }
    if (!pool || !swapReceive) return;
    const shown = swapPreview && swapPreview.key === swapPreviewKey ? swapPreview : null;
    if (!shown) {
      setNotice(swapPreviewState === "reading" ? "The quote is still being read." : "Wait until the quote and minimum are on the page.");
      return;
    }
    const api = chain.getApi();
    if (!api) return;
    const pay: AssetRef = { kind: "native" };
    const receive = swapReceive;
    const amount = parseDecimalToPlanck(swapAmount, NATIVE_DECIMALS);
    if (!amount || amount <= BigInt(0)) {
      setNotice("Enter a swap amount before signing.");
      return;
    }
    const signedMinimum = BigInt(shown.minimum);
    busyRef.current = true;
    setBusy("check");
    const id = crypto.randomUUID();
    let tracked = false;
    try {
      const priced = await quoteForSwap(api, pay, receive, amount);
      if (!priced || !swapStillExecutable(BigInt(priced.amount), signedMinimum)) {
        setSwapPreview(null);
        setSwapPreviewState("none");
        setNotice(priced ? "The quote no longer covers the minimum on the page. Nothing was signed." : await minimumReserveNotice(api, pool, receive));
        return;
      }
      const tx = buildSwapExactIn(api, pay, receive, amount, signedMinimum, signer.address);
      const review = await reviewExtrinsic(api, tx, signer.address, [amount], priced.blockHash ?? undefined);
      if (!review.ok) {
        setNotice(review.message);
        return;
      }
      const quoteStillCovers = async () => {
        const again = await quoteForSwap(api, pay, receive, amount);
        return again !== null && swapStillExecutable(BigInt(again.amount), signedMinimum);
      };
      if (!(await quoteStillCovers())) {
        setNotice("The quote no longer covers the minimum on the page. Nothing was submitted.");
        return;
      }
      setBusy("Sign swap");
      tracked = true;
      txs.push({ id, label: `Swap ${NATIVE_SYMBOL}`, status: "signing" });
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injected = await web3FromSource(signer.source);
      if (!injected.signer) throw new Error("This wallet did not provide a signer.");
      const result = await signAndSend(
        api,
        review.tx,
        signer.address,
        injected.signer,
        (update) => txs.patch(id, update),
        undefined,
        quoteStillCovers,
      );
      record("swap", `Swap ${NATIVE_SYMBOL}`, result);
      if (result.status === "finalized") void chain.refreshPools().catch(() => undefined);
    } catch (cause) {
      const text = errorText(cause);
      if (tracked) txs.patch(id, outcomeWithoutHash(text));
      setNotice(text);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function minimumReserveNotice(api: NonNullable<ReturnType<typeof chain.getApi>>, pool: PoolView, receive: AssetRef): Promise<string> {
    const fallback = "The node did not return a quote for this amount, so nothing was signed.";
    if (receive.kind !== "asset") return fallback;
    try {
      const [minimum, position] = await Promise.all([
        readAssetMinBalance(api, receive.id),
        readPoolPosition(api, pool.asset1, pool.asset2, pool.lpToken),
      ]);
      const reserve = sameAsset(pool.asset1, receive) ? position.reserve1 : sameAsset(pool.asset2, receive) ? position.reserve2 : null;
      if (minimum === null || reservePaysSwap(reserve, minimum) !== false) return fallback;
      const raw = balanceDigits(reserve);
      const decimals = assetDecimals(receive, new Map((chain.assets ?? []).flatMap((asset) => (asset.decimals === null ? [] : [[asset.id, asset.decimals] as const]))));
      const symbol = chain.assets?.find((asset) => asset.id === receive.id)?.symbol ?? `asset ${receive.id}`;
      if (!raw || decimals === null) return fallback;
      return `The pool holds ${formatUnits(raw, decimals)} ${symbol}. Its minimum balance is ${formatUnits(minimum.toString(), decimals)} ${symbol}, so a swap into ${symbol} has no quote until the pool holds more. Nothing was signed.`;
    } catch {
      return fallback;
    }
  }

  function linkProject(patch: { assetId?: string; collectionId?: string; poolLpToken?: string }) {
    if (!project.project) return;
    const error = project.save({ ...project.project, ...patch });
    if (error) setNotice(error);
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Testnet run"
        title="Signed execution"
        body="Each step is a separate signature from your Substrate wallet. PORTOVA does not hold a key and does not submit a transaction by itself. A hash is stored only after the node returns one. Finalized means system.ExtrinsicSuccess was read. Marketplace trading stays off while Nfts.Features excludes Trading."
      />
      <Panel className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Signer</h2>
          <StatusPill tone={signer ? "ok" : "warn"}>{signer ? "Wallet connected" : "No signer"}</StatusPill>
        </div>
        {signer ? <ProceedsFigure address={signer.address} /> : <p className="text-sm text-muted">Connect a Substrate account from the top bar. The free balance below is the only spendable figure.</p>}
        <p className="text-xs leading-5 text-faint">
          Pool setup fee {setupFee ? `${formatUnits(setupFee.poolSetupFee, NATIVE_DECIMALS)} ${setupFee.poolSetupFeeAsset}` : "is read from the chain when the node is connected"}. Trading {trading === null ? "has not been read" : trading ? "is enabled" : "is off"}.
        </p>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-medium">1. Token</h2>
          <label className="block text-xs text-muted">Asset id<input className={FIELD} value={assetId} onChange={(event) => setAssetId(event.target.value)} /></label>
          <label className="block text-xs text-muted">Name<input className={FIELD} value={tokenName} onChange={(event) => setTokenName(event.target.value)} /></label>
          <label className="block text-xs text-muted">Symbol<input className={FIELD} value={tokenSymbol} onChange={(event) => setTokenSymbol(event.target.value)} /></label>
          <p className="text-xs leading-5 text-faint">One batch creates the asset, sets metadata, and mints 1000 units at 18 decimals to the signer. The minimum balance is 1 unit.</p>
          <Action busy={busy} label="Sign token" onClick={() => void createToken()} />
        </Panel>
        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-medium">2. NFT</h2>
          <label className="block text-xs text-muted">Predicted collection id<input className={FIELD} value={collectionId} onChange={(event) => setCollectionId(event.target.value)} /></label>
          <label className="block text-xs text-muted">Collection metadata URI<input className={FIELD} value={collectionUri} onChange={(event) => setCollectionUri(event.target.value)} /></label>
          <p className="text-xs leading-5 text-faint">The batch writes collection and item metadata, mints item 0 to the signer, then locks metadata. The collection id is confirmed from the Created event after finalization.</p>
          <Action busy={busy} label="Sign NFT" onClick={() => void createNft()} />
        </Panel>
        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-medium">3. Pool</h2>
          <p className="text-sm leading-6 text-muted">{pool ? `Pool LP ${pool.lpToken} is already stored for ${NATIVE_SYMBOL} and asset ${assetId}.` : `No stored pool pairs ${NATIVE_SYMBOL} with asset ${assetId || "the chosen id"}.`}</p>
          <Action busy={busy} label="Sign pool" disabled={!pool && !assetReady} onClick={() => void createPool()} />
          {!pool && !assetReady ? <p className="text-xs leading-5 text-faint">Sign pool stays off until asset {assetId || "the chosen id"} is on chain.</p> : null}
        </Panel>
        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-medium">4. Liquidity and swap</h2>
          <label className="block text-xs text-muted">{NATIVE_SYMBOL} amount<input className={FIELD} value={nativeAmount} onChange={(event) => setNativeAmount(event.target.value)} /></label>
          <label className="block text-xs text-muted">Token amount<input className={FIELD} value={tokenAmount} onChange={(event) => setTokenAmount(event.target.value)} /></label>
          <p className="text-xs leading-5 text-faint">{pool ? depositMinimumLine(pool, nativeAmount, tokenAmount, chain.assets) ?? "Enter both amounts to see the minimum deposit." : "Create a pool before a deposit can be built."}</p>
          <Action busy={busy} label="Sign liquidity" disabled={!pool} onClick={() => void addLiquidity()} />
          <label className="block text-xs text-muted">Swap {NATIVE_SYMBOL} in<input className={FIELD} value={swapAmount} onChange={(event) => setSwapAmount(event.target.value)} /></label>
          <p className="text-sm leading-6 text-muted">{swapQuoteLine(swapPreviewState, swapPreview, swapPreviewKey, swapReceive, chain.assets)}</p>
          <Action busy={busy} label="Sign swap" disabled={!pool || swapPreview?.key !== swapPreviewKey} onClick={() => void swap()} />
          {notice ? <p className="text-sm leading-6 text-warn">{notice}</p> : null}
          <p className="text-xs leading-5 text-faint">Liquidity and swap stay unsigned until that pool is stored. Deposit more than 1 token. A pool that holds only the token's 1-unit minimum cannot quote a {NATIVE_SYMBOL} swap into that token. Sign swap stays off until the quote and minimum are shown. Slippage is 0.5%.</p>
        </Panel>
      </div>
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-medium">Evidence</h2>
          <p className="mt-1 text-sm text-muted">Stored in this browser. A row without a hash was not confirmed by the node.</p>
        </div>
        {!ready ? <p className="px-4 py-6 text-sm text-muted">Reading the local run record…</p> : evidence.length === 0 ? <p className="px-4 py-6 text-sm text-muted">No testnet step has been signed from this page.</p> : (
          <ul>
            {evidence.map((item, index) => (
              <li key={`${item.step}-${item.hash ?? index}`} className="border-b border-line px-4 py-3 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{item.label}</h3>
                  <StatusPill tone={toneFor(item.status)}>{labelFor(item.status)}</StatusPill>
                </div>
                {item.hash ? <p className="mt-2 font-mono text-xs break-all text-muted">{item.hash}</p> : <p className="mt-2 text-sm text-muted">No hash was returned.</p>}
                {item.refId ? <p className="mt-1 text-sm text-muted">Confirmed id {item.refId}</p> : null}
                {item.error ? <p className="mt-1 text-sm text-warn">{item.error}</p> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line px-4 py-3 text-sm text-muted">
          <Link href="/activity" className="text-blue hover:underline">Activity</Link> checks open hashes again. <Link href="/market" className="text-blue hover:underline">Marketplace</Link> list and buy stay disabled while trading is off.
        </p>
      </Panel>
      {notice ? <p className="text-sm leading-6 text-warn">{notice}</p> : null}
    </div>
  );
}

function Action({ busy, label, onClick, disabled = false }: { busy: string | null; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={Boolean(busy) || disabled} onClick={onClick} className="rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50">
      {busy === label ? "Waiting for the wallet…" : label}
    </button>
  );
}

function depositMinimumLine(
  pool: PoolView,
  nativeAmount: string,
  tokenAmount: string,
  assets: { id: string; decimals: number | null; symbol: string }[] | null,
): string | null {
  const decimals = new Map((assets ?? []).flatMap((asset) => (asset.decimals === null ? [] : [[asset.id, asset.decimals] as const])));
  const leftDecimals = assetDecimals(pool.asset1, decimals);
  const rightDecimals = assetDecimals(pool.asset2, decimals);
  if (leftDecimals === null || rightDecimals === null) return null;
  const desired1 = parseDecimalToPlanck(pool.asset1.kind === "native" ? nativeAmount : tokenAmount, leftDecimals);
  const desired2 = parseDecimalToPlanck(pool.asset2.kind === "native" ? nativeAmount : tokenAmount, rightDecimals);
  if (!desired1 || !desired2) return null;
  const reserve1 = balanceDigits(pool.reserve1);
  const reserve2 = balanceDigits(pool.reserve2);
  const deposit = optimalDeposit(desired1, desired2, reserve1 === null ? null : BigInt(reserve1), reserve2 === null ? null : BigInt(reserve2));
  if (!deposit) return null;
  const min1 = applySlippage(deposit.amount1, "0.5");
  const min2 = applySlippage(deposit.amount2, "0.5");
  if (min1 === null || min2 === null || min1 <= BigInt(0) || min2 <= BigInt(0)) return null;
  const left = assetSymbol(pool.asset1, assets);
  const right = assetSymbol(pool.asset2, assets);
  return `Minimum deposit ${formatUnits(min1.toString(), leftDecimals)} ${left} and ${formatUnits(min2.toString(), rightDecimals)} ${right}. The signed call reads the reserves again and can differ.`;
}

function swapQuoteLine(
  state: "idle" | "reading" | "ready" | "none",
  preview: { key: string; out: string; minimum: string } | null,
  key: string,
  receive: AssetRef | null,
  assets: { id: string; decimals: number | null; symbol: string }[] | null,
): string {
  if (!receive) return "A quote appears here after the pool is stored.";
  if (state === "reading") return "Reading the quote…";
  const decimals = assetDecimals(receive, new Map((assets ?? []).flatMap((asset) => (asset.decimals === null ? [] : [[asset.id, asset.decimals] as const]))));
  const symbol = assetSymbol(receive, assets);
  if (state === "ready" && preview && preview.key === key && decimals !== null) {
    return `Quote ${formatUnits(preview.out, decimals)} ${symbol}. Minimum ${formatUnits(preview.minimum, decimals)} ${symbol}.`;
  }
  if (state === "none") return "No quote for this amount yet.";
  return "The quote and minimum appear here before the wallet opens.";
}

function assetSymbol(asset: AssetRef, assets: { id: string; symbol: string }[] | null): string {
  if (asset.kind === "native") return NATIVE_SYMBOL;
  return assets?.find((item) => item.id === asset.id)?.symbol ?? `asset ${asset.id}`;
}

function findNativePool(pools: PoolView[] | null, assetId: string): PoolView | null {
  if (!pools || !assetId) return null;
  return pools.find((pool) => {
    const refs = [pool.asset1, pool.asset2];
    return refs.some((asset) => asset.kind === "native") && refs.some((asset) => asset.kind === "asset" && asset.id === assetId);
  }) ?? null;
}

function toneFor(status: TxStatus): "ok" | "warn" | "bad" | "muted" {
  if (status === "finalized") return "ok";
  if (status === "failed") return "bad";
  if (status === "ambiguous" || status === "submitted" || status === "included" || status === "signing") return "warn";
  return "muted";
}

function labelFor(status: TxStatus): string {
  if (status === "finalized") return "Finalized";
  if (status === "failed") return "Failed";
  if (status === "included") return "Included";
  if (status === "submitted") return "Submitted";
  if (status === "ambiguous") return "Unknown";
  return "Waiting for signature";
}
