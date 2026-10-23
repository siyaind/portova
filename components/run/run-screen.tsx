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
import { errorText, formatUnits, parseDecimalToPlanck } from "@/lib/format";
import { readTradingEnabled } from "@/lib/market";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import {
  buildCollectionMintTx,
  byteDeposit,
  createdCollectionUpdate,
  predictCollectionId,
  readNftConstants,
} from "@/lib/nfts";
import { applySlippage, assetDecimals, buildAddLiquidity, buildCreatePool, buildSwapExactIn, missingLpAccountDeposit, quoteExactIn, readPoolConstants, readPoolPosition, readPools, sameAsset, type AssetRef, type PoolView } from "@/lib/pools";
import { optimalDeposit } from "@/lib/liquidity-math";
import { sameFacts } from "@/lib/pool-position";
import { reviewExtrinsic } from "@/lib/preflight";
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
  const [tokenAmount, setTokenAmount] = useState("1");
  const [swapAmount, setSwapAmount] = useState("0.1");

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

  useEffect(() => {
    if (assetId || !chain.assets) return;
    const ids = chain.assets.map((asset) => Number(asset.id)).filter((id) => Number.isInteger(id) && id >= 0);
    setAssetId(String(ids.length === 0 ? 1 : Math.max(...ids) + 1));
  }, [assetId, chain.assets]);

  const pool = findNativePool(chain.pools, assetId);
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
    setNotice(txResultMessage(result.status, result.error));
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
  ): Promise<TxUpdate | null> {
    if (!signer) {
      await wallet.connect();
      return null;
    }
    if (busyRef.current) return null;
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
    busyRef.current = true;
    setBusy(label);
    const id = crypto.randomUUID();
    txs.push({ id, label, status: "signing" });
    try {
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injected = await web3FromSource(signer.source);
      if (!injected.signer) throw new Error("This wallet did not provide a signer.");
      return await signAndSend(api, review.tx, signer.address, injected.signer, (update) => txs.patch(id, update), decorate);
    } catch (cause) {
      const text = errorText(cause);
      const failed = outcomeWithoutHash(text);
      txs.patch(id, failed);
      setNotice(failed.error);
      return failed;
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
    ]);
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
    const predicted = await predictCollectionId(api).catch(() => null);
    if (!constants || predicted === null || !collectionUri.trim()) {
      setNotice("Collection constants or the next collection id are not ready, so nothing was signed.");
      return;
    }
    setCollectionId(String(predicted));
    const itemMetadata = "ipfs://portova/run-item";
    const tx = buildCollectionMintTx(api, {
      admin: signer.address,
      collectionId: predicted,
      transferable: true,
      metadataEditable: false,
      maxSupply: 1,
      publicMint: false,
      price: null,
      collectionMetadata: collectionUri.trim(),
      itemMetadata,
      itemId: 0,
      mintTo: signer.address,
    });
    const result = await sign(
      `Create collection ${predicted}`,
      tx,
      [
        planck(constants.collectionDeposit),
        planck(constants.itemDeposit),
        byteDeposit(constants, collectionUri.trim()),
        byteDeposit(constants, itemMetadata),
        0n,
      ],
      createdCollectionUpdate,
    );
    if (!result) return;
    const confirmed = result.collectionId && result.status === "finalized" ? result.collectionId : undefined;
    record("nft", `Create collection ${predicted}`, result, confirmed);
    if (confirmed) setCollectionId(confirmed);
    if (result.status === "finalized" || result.status === "included") await chain.refreshCollections().catch(() => undefined);
    if (confirmed) linkProject({ collectionId: confirmed });
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
    const result = await sign(`Create pool ${NATIVE_SYMBOL}/${assetId}`, tx, [setup]);
    if (!result) return;
    record("pool", `Create pool ${NATIVE_SYMBOL}/${assetId}`, result);
    if (result.status === "finalized" || result.status === "included") {
      await chain.refreshPools().catch(() => undefined);
      const api = chain.getApi();
      const pools = api ? await readPools(api).catch(() => []) : [];
      const created = findNativePool(pools, assetId);
      if (created && result.status === "finalized") linkProject({ poolLpToken: created.lpToken });
    }
  }

  async function addLiquidity() {
    if (!signer || !pool) {
      setNotice("Add liquidity after the pool is stored on chain.");
      return;
    }
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
        return sameFacts(
          [position.reserve1, position.reserve2, position.lpSupply],
          [next.reserve1, next.reserve2, next.lpSupply],
        );
      },
    );
    if (!result) return;
    record("liquidity", `Add liquidity LP ${pool.lpToken}`, result, result.status === "finalized" ? pool.lpToken : undefined);
    if (result.status === "finalized" || result.status === "included") await chain.refreshPools().catch(() => undefined);
  }

  async function swap() {
    if (!signer) {
      await wallet.connect();
      return;
    }
    if (!pool || busyRef.current) return;
    const api = chain.getApi();
    if (!api) return;
    const pay: AssetRef = { kind: "native" };
    const receive = pool.asset1.kind === "native" ? pool.asset2 : pool.asset1;
    const amount = parseDecimalToPlanck(swapAmount, NATIVE_DECIMALS);
    if (!amount || amount <= BigInt(0)) {
      setNotice("Enter a swap amount before signing.");
      return;
    }
    busyRef.current = true;
    setBusy("Sign swap");
    const id = crypto.randomUUID();
    try {
      const hash = (await api.rpc.chain.getFinalizedHead()).toHex();
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("The finalized block hash could not be read.");
      const fresh = await quoteExactIn(api, pay, receive, amount, hash);
      const minimum = fresh && /^\d+$/.test(fresh) ? applySlippage(BigInt(fresh), "0.5") : null;
      if (!fresh || !minimum || minimum <= BigInt(0)) {
        setNotice("The node did not return a quote for this amount, so nothing was signed.");
        return;
      }
      const tx = buildSwapExactIn(api, pay, receive, amount, minimum, signer.address);
      const review = await reviewExtrinsic(api, tx, signer.address, [amount], hash);
      if (!review.ok) {
        setNotice(review.message);
        return;
      }
      const againHash = (await api.rpc.chain.getFinalizedHead()).toHex();
      const again = /^0x[0-9a-fA-F]{64}$/.test(againHash) ? await quoteExactIn(api, pay, receive, amount, againHash) : null;
      if (!sameFacts([fresh], [again])) {
        setNotice("The quote changed after the fee check. Nothing was submitted.");
        return;
      }
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
      );
      record("swap", `Swap ${NATIVE_SYMBOL}`, result);
      if (result.status === "finalized") await chain.refreshPools().catch(() => undefined);
    } catch (cause) {
      const text = errorText(cause);
      txs.patch(id, outcomeWithoutHash(text));
      setNotice(text);
    } finally {
      busyRef.current = false;
      setBusy(null);
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
          <Action busy={busy} label="Sign pool" onClick={() => void createPool()} />
        </Panel>
        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-medium">4. Liquidity and swap</h2>
          <label className="block text-xs text-muted">{NATIVE_SYMBOL} amount<input className={FIELD} value={nativeAmount} onChange={(event) => setNativeAmount(event.target.value)} /></label>
          <label className="block text-xs text-muted">Token amount<input className={FIELD} value={tokenAmount} onChange={(event) => setTokenAmount(event.target.value)} /></label>
          <Action busy={busy} label="Sign liquidity" disabled={!pool} onClick={() => void addLiquidity()} />
          <label className="block text-xs text-muted">Swap {NATIVE_SYMBOL} in<input className={FIELD} value={swapAmount} onChange={(event) => setSwapAmount(event.target.value)} /></label>
          <Action busy={busy} label="Sign swap" disabled={!pool} onClick={() => void swap()} />
          <p className="text-xs leading-5 text-faint">Liquidity and swap stay unsigned until that pool is stored. The swap signs only after a fresh node quote. Slippage is 0.5%.</p>
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
