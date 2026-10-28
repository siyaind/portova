"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { planck } from "@/lib/balance";
import { readAssetMinBalance } from "@/lib/chain-read";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { PageIntro, Panel, StatusPill } from "@/components/ui";
import { useWalletOperation } from "@/components/wallet/use-wallet-operation";
import { assetRemainder, optimalDeposit, pairedAmount, removalMinimum } from "@/lib/liquidity-math";
import { outcomeWithoutHash, txResultMessage } from "@/lib/tx-result";
import { errorText, formatUnits, parseDecimalToPlanck } from "@/lib/format";
import {
  applySlippage,
  assetDecimals,
  assetKey,
  assetLabel,
  buildAddLiquidity,
  buildCreatePool,
  buildRemoveLiquidity,
  poolLabel,
  missingLpAccountDeposit,
  readLpBalance,
  readPoolConstants,
  readPoolPosition,
  reservesUsable,
  sameAsset,
  type AssetRef,
  type PoolConstants,
  type PoolView,
} from "@/lib/pools";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import { reviewExtrinsic } from "@/lib/preflight";
import { WALLET_MOVE_WARNING, depositStillExecutable, withdrawalStillExecutable } from "@/lib/quote-window";
import { useProject } from "@/components/project/project-provider";
import { acquireLease } from "@/lib/browser-lock";
import { readPools } from "@/lib/pools";
import { checkLiquidityDeposit } from "@/lib/liquidity-checks";

const FIELD =
  "h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink";
export function LiquidityScreen({ projectId, assetId }: { projectId?: string; assetId?: string } = {}) {
  const chain = useChain();
  const wallet = useSubstrateWallet();
  const txs = useTxs();
  const project = useProject();
  const signer = wallet.selected;
  const maps = useAssetMaps();
  const [constants, setConstants] = useState<PoolConstants | null>(null);
  const [left, setLeft] = useState<AssetRef>({ kind: "native" });
  const [right, setRight] = useState<AssetRef>({ kind: "asset", id: assetId ?? chain.assets?.[0]?.id ?? "1" });
  const [poolLp, setPoolLp] = useState<string | null>(null);
  useEffect(() => { const requested = new URLSearchParams(window.location.search).get("pool"); if (requested && /^\d+$/.test(requested)) setPoolLp(requested); }, []);
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [lpBalance, setLpBalance] = useState<string | null>(null);
  const [lpRead, setLpRead] = useState<"idle" | "reading" | "ready">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const amounts = useRef({ first: "", second: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const actionRef = useRef(false);
  const [reviewPrompt, setReviewPrompt] = useState<{ label: string; fee: string; reserve: string; total: string; expires: number } | null>(null);
  const approval = useRef<((accepted: boolean) => void) | null>(null);
  function closeReview(accepted: boolean) { approval.current?.(accepted); approval.current = null; setReviewPrompt(null); }
  useEffect(() => () => { approval.current?.(false); }, []);
  useEffect(() => { approval.current?.(false); approval.current = null; setReviewPrompt(null); }, [signer?.address, amount1, amount2, lpAmount, slippage, left, right, poolLp]);

  const relevantPools = assetId ? chain.pools?.filter(item => [item.asset1, item.asset2].some(side => side.kind === "native") && [item.asset1, item.asset2].some(side => side.kind === "asset" && side.id === assetId)) : chain.pools;
  const pool = relevantPools?.find((item) => item.lpToken === poolLp) ?? relevantPools?.[0] ?? null;
  const pairExists = chain.pools?.some(item => (sameAsset(item.asset1, left) && sameAsset(item.asset2, right)) || (sameAsset(item.asset1, right) && sameAsset(item.asset2, left))) ?? false;
  const { signAndSend } = useWalletOperation({ left, right, pool: pool?.lpToken, amount1, amount2, lpAmount, slippage, projectId, projectRevision: projectId ? project.project?.revision : null });

  useEffect(() => {
    amounts.current = { first: "", second: "" };
    setAmount1("");
    setAmount2("");
    setLpAmount("");
    setAddMessage(null);
    setMessage(null);
  }, [pool?.lpToken]);

  useEffect(() => {
    const api = chain.getApi();
    if (chain.status !== "live" || !api) return;
    setConstants(readPoolConstants(api));
  }, [chain, chain.status]);

  useEffect(() => {
    if (!assetId && chain.assets?.[0] && right.kind === "asset" && right.id === "1" && !chain.assets.some((asset) => asset.id === "1")) {
      setRight({ kind: "asset", id: chain.assets[0].id });
    }
  }, [chain.assets, right, assetId]);

  useEffect(() => {
    const api = chain.getApi();
    if (!api || !signer || !pool || chain.status !== "live") {
      setLpBalance(null);
      setLpRead("idle");
      return;
    }
    let cancelled = false;
    setLpRead("reading");
    void readLpBalance(api, pool.lpToken, signer.address)
      .then((balance) => {
        if (cancelled) return;
        setLpBalance(balance);
        setLpRead("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setLpBalance(null);
        setLpRead("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [chain.status, chain.getApi, pool, signer]);

  const depositPreview = useMemo(
    () => previewDeposit(pool, amount1, amount2, slippage, maps.decimals),
    [pool, amount1, amount2, slippage, maps.decimals],
  );

  useEffect(() => {
    setAddMessage(null);
  }, [signer?.address]);

  async function sign(input: {
    label: string;
    tx: ReturnType<typeof buildCreatePool>;
    nativeDebits: Array<bigint | null>;
    refresh?: boolean;
    place?: "add" | "other";
    blockHash?: string;
    stillCurrent?: () => Promise<boolean>;
    createdPair?: { first: AssetRef; second: AssetRef };
  }) {
    const refresh = input.refresh ?? true;
    const place = input.place ?? "other";
    const report = place === "add" ? setAddMessage : setMessage;
    report(null);
    if (!signer) {
      await wallet.connect();
      return;
    }
    const api = chain.getApi();
    if (!api) return;
    const review = await reviewExtrinsic(api, input.tx, signer.address, input.nativeDebits, input.blockHash);
    if (!review.ok) {
      report(review.message);
      return;
    }
    if (input.stillCurrent) {
      try {
        if (!(await input.stillCurrent())) {
          report("The chain moved after the fee check. Nothing was submitted.");
          return;
        }
      } catch (cause) {
        report(errorText(cause));
        return;
      }
    }
    const id = crypto.randomUUID();
    let release: (() => void) | undefined;
    setBusy(input.label);
    try {
      const expires = Date.now() + 60000;
      const accepted = await new Promise<boolean>(resolve => {
        approval.current = resolve;
        setReviewPrompt({ label: input.label, fee: review.estimatedFee.toString(), reserve: review.fee.toString(), total: review.nativeNeed.toString(), expires });
      });
      if (!accepted) { report("Review cancelled. No wallet request was opened."); return; }
      if (Date.now() > expires) throw Error("The cost review expired. Review the operation again.");
      const fresh = await reviewExtrinsic(api, input.tx, signer.address, input.nativeDebits);
      if (!fresh.ok || fresh.nativeNeed > review.nativeNeed) throw Error("The balance or fee changed. Review the updated operation again.");
      if (projectId) { if (project.project?.id !== projectId) throw Error("The project changed. Review its current links before signing."); const lease = await acquireLease(`portova:guided:${projectId}`, navigator.locks); release = lease.release; }
      txs.push({ id, label: input.label, status: "signing", projectId });
      const result = await signAndSend(
        api,
        review.tx,
        signer.address,
        (await injectedSigner(signer.source)).signer,
        (update) => txs.patch(id, update),
        undefined,
        input.stillCurrent,
      );
      report(result.hash ? `${txResultMessage(result.status, result.error)} ${result.hash}` : txResultMessage(result.status, result.error));
      if (projectId && result.status === "finalized" && input.createdPair) {
        const pair = input.createdPair;
        const created = (await readPools(api)).find(row => (sameAsset(row.asset1, pair.first) && sameAsset(row.asset2, pair.second)) || (sameAsset(row.asset1, pair.second) && sameAsset(row.asset2, pair.first)));
        if (!created) report("Pool creation finalized. Refresh pools and link the resulting LP token in the guide.");
        else { txs.patch(id, { projectField: "poolLpToken", objectId: created.lpToken }); const error = await project.attach(projectId, "poolLpToken", created.lpToken, signer.address); if (error) report(error); }
      }
      if ((result.status === "finalized" || result.status === "included") && refresh) {
        void chain.refreshPools().catch(() => undefined);
      }
    } catch (cause) {
      const text = errorText(cause);
      report(text);
      txs.patch(id, outcomeWithoutHash(text));
    } finally {
      release?.();
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        as={projectId ? "h2" : "h1"}
        eyebrow="Liquidity"
        title="Bring your assets together."
        body="Create a pool, manage your deposits, and withdraw liquidity from your wallet. Every action is a separate signature, with reserves and fees read from the network."
      />
      {projectId && message && <p role="status" className="text-sm leading-6 text-warn">{message}</p>}
      {reviewPrompt && <Panel className="space-y-3 border-violet/50 p-5"><h2 className="text-lg font-semibold">Review {reviewPrompt.label.toLowerCase()}</h2><p className="text-sm text-muted">{reviewPrompt.label === "Add liquidity" ? `Deposit ${amount1} ${pool ? assetLabel(pool.asset1, maps.symbols) : ""} + ${amount2} ${pool ? assetLabel(pool.asset2, maps.symbols) : ""}. A missing LP account is prepared in the same transaction; its deposit is reserved, not spent as a fee.` : reviewPrompt.label === "Remove liquidity" ? `Burn ${lpAmount} LP units. Max withdraws your balance; the pool's permanently locked minimum liquidity remains.` : `Create ${assetLabel(left, maps.symbols)} / ${assetLabel(right, maps.symbols)}. Pool setup is a separate operation from adding liquidity.`}</p><p className="text-sm">Estimated network fee: {formatUnits(reviewPrompt.fee, NATIVE_DECIMALS, 10)} tPOT</p><p className="text-sm">Fee budget: {formatUnits(reviewPrompt.reserve, NATIVE_DECIMALS, 10)} tPOT</p><p className="text-sm">Total native balance needed, including deposits/transfers: {formatUnits(reviewPrompt.total, NATIVE_DECIMALS, 10)} tPOT</p><p className="text-xs text-faint">This review expires after 60 seconds. Your wallet approval is still required.</p><div className="flex gap-3"><button className="min-h-11 rounded-lg bg-violet px-4 text-violet-ink" onClick={() => closeReview(true)}>Continue to wallet</button><button className="min-h-11 rounded-lg border border-line px-4" onClick={() => closeReview(false)}>Cancel</button></div></Panel>}
      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Stored pools</h2>
          <StatusPill tone={chain.status === "connecting" || chain.pools === null ? "warn" : chain.poolCount === 0 ? "muted" : "ok"}>
            {chain.status === "connecting" ? "Reading" : chain.poolCount === null ? "Count unavailable" : `${chain.poolCount} on chain`}
          </StatusPill>
        </div>
        {chain.pools === null ? (
          <p className="mt-3 text-sm text-muted">
            {chain.status === "connecting" ? "Reading pools from the testnet." : "The pool list is unavailable."}
          </p>
        ) : chain.pools.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            {chain.discovery.pools.complete ? "AssetConversion.pools has 0 records at its snapshot." : "Pool discovery is incomplete. Refresh discovery before concluding that no pool exists."}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {(relevantPools ?? []).map((item) => (
              <li key={item.lpToken}>
                <button
                  type="button"
                  onClick={() => setPoolLp(item.lpToken)}
                  className={`w-full rounded-lg border px-3 py-3 text-left ${
                    item.lpToken === pool?.lpToken ? "border-violet" : "border-line"
                  }`}
                >
                  <span className="text-sm font-medium">{poolLabel(item, maps.symbols)}</span>
                  <span className="mt-1 block text-xs text-muted">
                    LP token #{item.lpToken}. {reserveText(item, maps)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel className="space-y-4 p-4">
          <h2 className="text-sm font-medium">Create a pool</h2>
          <p className="text-xs leading-5 text-faint">
            Setup fee {constants ? `${formatUnits(constants.poolSetupFee, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}` : chain.status === "connecting" ? "reading" : "unavailable"}, paid in {constants?.poolSetupFeeAsset ?? "the native token"}. Swap fee {constants?.lpFee ?? (chain.status === "connecting" ? "reading" : "unavailable")}. This call does not add liquidity.
          </p>
          <fieldset disabled={Boolean(projectId)} className="space-y-4">
          <AssetPicker label="First asset" value={left} assets={chain.assets} onChange={setLeft} />
          <AssetPicker label="Second asset" value={right} assets={chain.assets} onChange={setRight} />
          </fieldset>
          {sameAsset(left, right) ? <p className="text-sm text-warn">Choose two different assets.</p> : null}
          {wallet.error ? <p className="text-sm text-warn">{wallet.error}</p> : null}
          <button
            type="button"
            disabled={Boolean(busy) || chain.status !== "live" || sameAsset(left, right) || pairExists}
            onClick={() => void submitCreate()}
            className="w-full rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pairExists ? "Pool already exists" : busy === "Create pool" ? "Waiting for the wallet…" : signer ? "Create pool" : "Connect Substrate wallet"}
          </button>
        </Panel>

        <Panel className="space-y-4 p-4">
          <h2 className="text-sm font-medium">Add liquidity</h2>
          {pool ? (
            <>
              <p className="text-xs leading-5 text-faint">
                {poolLabel(pool, maps.symbols)}. When reserves exist, the deposit is reduced to the pool ratio before {slippage}% slippage. Without reserves, the entered amounts are used and the pallet can still reject them. The first deposit locks {constants ? constants.mintMinLiquidity : "the chain minimum"} base units of the LP token.
              </p>
              <AmountField
                label={assetLabel(pool.asset1, maps.symbols)}
                value={amount1}
                onChange={(value) => fillFromReserves(1, value)}
              />
              <AmountField
                label={assetLabel(pool.asset2, maps.symbols)}
                value={amount2}
                onChange={(value) => fillFromReserves(2, value)}
              />
              <Slippage value={slippage} onChange={setSlippage} />
              <DepositMinimum pool={pool} preview={depositPreview} symbols={maps.symbols} />
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void submitAdd()}
                className="w-full rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "Add liquidity" ? "Waiting for the wallet…" : signer ? "Add liquidity" : "Connect Substrate wallet"}
              </button>
              <p className="text-xs leading-5 text-faint">{WALLET_MOVE_WARNING}</p>
              {addMessage ? <p className="text-sm leading-6 text-warn">{addMessage}</p> : null}
            </>
          ) : (
            <p className="text-sm text-muted">Create a pool before a deposit can be built.</p>
          )}
        </Panel>
      </div>

      {!projectId && <Panel className="space-y-4 p-4">
        <h2 className="text-sm font-medium">Remove liquidity</h2>
        {!signer ? (
          <p className="text-sm text-muted">Connect a Substrate wallet to read an LP balance.</p>
        ) : !pool ? (
          <p className="text-sm text-muted">No pool is selected.</p>
        ) : lpRead !== "ready" ? (
          <p className="text-sm text-muted">Reading the LP balance…</p>
        ) : lpBalance === null ? (
          <p className="text-sm text-muted">LP balance is unavailable.</p>
        ) : lpBalance === "0" ? (
          <p className="text-sm text-muted">This account has no LP token #{pool.lpToken}.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Balance {formatLp(lpBalance, pool.lpDecimals)} of LP #{pool.lpToken}. Withdrawal fee {constants?.withdrawalFee ?? (chain.status === "connecting" ? "reading" : "unavailable")}.
              {rawLpUnits(pool.lpDecimals)
                ? " LP decimals were not returned, so Max and this field use raw base units."
                : " Enter a decimal amount."}
            </p>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <AmountField label={rawLpUnits(pool.lpDecimals) ? "Raw LP units to burn" : "LP tokens to burn"} value={lpAmount} onChange={setLpAmount} />
              </div>
              <button
                type="button"
                className="h-10 rounded-lg border border-line px-3 text-sm"
                onClick={() => setLpAmount(rawLpUnits(pool.lpDecimals) ? lpBalance : formatUnits(lpBalance, pool.lpDecimals ?? 0, pool.lpDecimals ?? 0).replace(/,/g, ""))}
              >
                Max
              </button>
            </div>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void submitRemove()}
              className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50"
            >
              {busy === "Remove liquidity" ? "Waiting for the wallet…" : "Remove liquidity"}
            </button>
            <p className="text-xs leading-5 text-faint">{WALLET_MOVE_WARNING}</p>
          </>
        )}
        {message ? <p className="text-sm leading-6 text-warn">{message}</p> : null}
      </Panel>}
    </div>
  );

  async function submitCreate() {
    if (pairExists) { setMessage("This pair already has a stored pool. Select it and review a deposit instead of creating it again."); return; }
    if (actionRef.current) return;
    if (!signer) {
      await wallet.connect();
      return;
    }
    actionRef.current = true;
    setBusy("prepare");
    try {
      const api = chain.getApi();
      if (!api || !constants || !/native/i.test(constants.poolSetupFeeAsset)) {
        setMessage("The pool setup fee could not be read as a native deposit, so the wallet was not opened.");
        return;
      }
      await sign({
        label: "Create pool",
        tx: buildCreatePool(api, left, right),
        nativeDebits: [planck(constants.poolSetupFee)],
        createdPair: { first: left, second: right },
      });
    } finally {
      actionRef.current = false;
      setBusy(null);
    }
  }

  async function submitAdd() {
    if (actionRef.current) return;
    if (!pool || !signer) {
      await wallet.connect();
      return;
    }
    actionRef.current = true;
    setBusy("prepare");
    try {
    const decimals1 = assetDecimals(pool.asset1, maps.decimals);
    const decimals2 = assetDecimals(pool.asset2, maps.decimals);
    if (decimals1 === null || decimals2 === null) {
      setAddMessage("Decimals for one side are unavailable, so the deposit was not built.");
      return;
    }
    const desired1 = parseDecimalToPlanck(amounts.current.first, decimals1);
    const desired2 = parseDecimalToPlanck(amounts.current.second, decimals2);
    if (!desired1 || !desired2) {
      setAddMessage("Enter amounts that stay above zero after slippage.");
      return;
    }
    const snapshot = await chain.readAccount(signer.address);
    const spendableText = snapshot.spendable?.replace(/,/g, "") ?? "";
    if (snapshot.error || !/^\d+$/.test(spendableText)) {
      setAddMessage(snapshot.error ?? "The spendable balance could not be read, so the wallet was not opened.");
      return;
    }
    if (snapshot.holdingsComplete === false) { setAddMessage("The asset balance snapshot is incomplete. Refresh discovery and balances before depositing."); return; }
    const api = chain.getApi();
    if (!api) {
      setAddMessage("The testnet connection is unavailable, so the wallet was not opened.");
      return;
    }
    let position;
    try {
      position = await readPoolPosition(api, pool.asset1, pool.asset2, pool.lpToken);
    } catch (cause) {
      setAddMessage(errorText(cause));
      return;
    }
    const reserve1 = position.reserve1 && /^\d+$/.test(position.reserve1.replace(/,/g, "")) ? BigInt(position.reserve1.replace(/,/g, "")) : null;
    const reserve2 = position.reserve2 && /^\d+$/.test(position.reserve2.replace(/,/g, "")) ? BigInt(position.reserve2.replace(/,/g, "")) : null;
    const deposit = optimalDeposit(desired1, desired2, reserve1, reserve2);
    const min1 = deposit ? applySlippage(deposit.amount1, slippage) : null;
    const min2 = deposit ? applySlippage(deposit.amount2, slippage) : null;
    if (!deposit || !min1 || !min2 || min1 <= BigInt(0) || min2 <= BigInt(0)) {
      setAddMessage("The reserve ratio does not produce a deposit above zero, so nothing was signed.");
      return;
    }
    const nativeIn = pool.asset1.kind === "native" ? deposit.amount1 : pool.asset2.kind === "native" ? deposit.amount2 : BigInt(0);
    const spendable = BigInt(spendableText);
    let lpDeposit: bigint | null = null;
    try {
      lpDeposit = await missingLpAccountDeposit(api, pool.lpToken, signer.address, position.blockHash);
    } catch (cause) {
      setAddMessage(errorText(cause));
      return;
    }
    const assetSides: Array<{ id: string; amount: bigint; decimals: number; name: string }> = [];
    if (pool.asset1.kind === "asset") {
      assetSides.push({
        id: pool.asset1.id,
        amount: deposit.amount1,
        decimals: decimals1,
        name: assetLabel(pool.asset1, maps.symbols),
      });
    }
    if (pool.asset2.kind === "asset") {
      assetSides.push({
        id: pool.asset2.id,
        amount: deposit.amount2,
        decimals: decimals2,
        name: assetLabel(pool.asset2, maps.symbols),
      });
    }
    for (const side of assetSides) {
      const name = side.name;
      const have = assetBalance({ kind: "asset", id: side.id }, spendable, snapshot.holdings);
      let minBalance: bigint | null = null;
      try {
        minBalance = await readAssetMinBalance(api, side.id, position.blockHash);
      } catch (cause) {
        setAddMessage(errorText(cause));
        return;
      }
      if (minBalance === null) {
        setAddMessage(`The minimum balance for ${name} could not be read, so the wallet was not opened.`);
        return;
      }
      const remainder = assetRemainder(have, side.amount, minBalance);
      if (remainder === "short") {
        setAddMessage(
          `${name} is short. This deposit needs ${shownAmount(side.amount, side.decimals, name)} and this account has ${shownAmount(have, side.decimals, name)}. The wallet was not opened.`,
        );
        return;
      }
      if (remainder === "dust") {
        setAddMessage(`This deposit would leave ${name} below its minimum balance. The wallet was not opened.`);
        return;
      }
    }
    await checkLiquidityDeposit(api, { ...pool, ...position }, signer.address, deposit.amount1, deposit.amount2, position.blockHash);
    const tx = buildAddLiquidity(api, pool, deposit.amount1, deposit.amount2, min1, min2, signer.address, lpDeposit !== null && lpDeposit > 0n);
    await sign({
      label: "Add liquidity",
      tx,
      nativeDebits: [nativeIn, lpDeposit],
      place: "add",
      blockHash: position.blockHash,
      stillCurrent: async () => {
        const next = await readPoolPosition(api, pool.asset1, pool.asset2, pool.lpToken);
        await checkLiquidityDeposit(api, { ...pool, ...next }, signer.address, deposit.amount1, deposit.amount2, next.blockHash);
        const nextReserve1 = next.reserve1 && /^\d+$/.test(next.reserve1) ? BigInt(next.reserve1) : null;
        const nextReserve2 = next.reserve2 && /^\d+$/.test(next.reserve2) ? BigInt(next.reserve2) : null;
        return depositStillExecutable(deposit.amount1, deposit.amount2, min1, min2, nextReserve1, nextReserve2);
      },
    });
    } catch (cause) { setAddMessage(errorText(cause)); } finally {
      actionRef.current = false;
      setBusy(null);
    }
  }

  async function submitRemove() {
    if (actionRef.current) return;
    if (!pool || !signer || !lpBalance) return;
    actionRef.current = true;
    setBusy("prepare");
    try {
    const raw = rawLpUnits(pool.lpDecimals)
      ? (/^\d+$/.test(lpAmount.trim()) ? BigInt(lpAmount.trim()) : null)
      : parseDecimalToPlanck(lpAmount, pool.lpDecimals ?? 0);
    if (raw === null || raw <= BigInt(0) || raw > BigInt(lpBalance)) {
      setMessage("Enter an LP amount you hold.");
      return;
    }
    const api = chain.getApi();
    if (!api) {
      setMessage("The testnet connection is unavailable, so the wallet was not opened.");
      return;
    }
    let position;
    try {
      position = await readPoolPosition(api, pool.asset1, pool.asset2, pool.lpToken);
    } catch (cause) {
      setMessage(errorText(cause));
      return;
    }
    const min1 = removalMinimum(position.reserve1, position.lpSupply, raw, slippage);
    const min2 = removalMinimum(position.reserve2, position.lpSupply, raw, slippage);
    if (min1 === null || min2 === null) {
      setMessage("Reserves or LP supply are unavailable, so a minimum receive amount was not invented.");
      return;
    }
    const tx = buildRemoveLiquidity(api, pool, raw, min1, min2, signer.address);
    await sign({
      label: "Remove liquidity",
      tx,
      nativeDebits: [0n],
      blockHash: position.blockHash,
      stillCurrent: async () => {
        const next = await readPoolPosition(api, pool.asset1, pool.asset2, pool.lpToken);
        const nextReserve1 = next.reserve1 && /^\d+$/.test(next.reserve1) ? BigInt(next.reserve1) : null;
        const nextReserve2 = next.reserve2 && /^\d+$/.test(next.reserve2) ? BigInt(next.reserve2) : null;
        const supply = next.lpSupply && /^\d+$/.test(next.lpSupply) ? BigInt(next.lpSupply) : null;
        if (nextReserve1 === null || nextReserve2 === null || supply === null) return false;
        return withdrawalStillExecutable(nextReserve1, nextReserve2, supply, raw, min1, min2);
      },
    });
    } finally {
      actionRef.current = false;
      setBusy(null);
    }
  }

  function fillFromReserves(side: 1 | 2, text: string) {
    setAddMessage(null);
    const next = { ...amounts.current, [side === 1 ? "first" : "second"]: text };
    if (!text.trim()) {
      next.first = "";
      next.second = "";
    }
    amounts.current = next;
    setAmount1(next.first);
    setAmount2(next.second);
    if (!text.trim()) return;
    if (!pool || !reservesUsable(pool) || !pool.reserve1 || !pool.reserve2) return;
    const decimals1 = assetDecimals(pool.asset1, maps.decimals);
    const decimals2 = assetDecimals(pool.asset2, maps.decimals);
    if (decimals1 === null || decimals2 === null) return;
    const raw = parseDecimalToPlanck(text, side === 1 ? decimals1 : decimals2);
    if (raw === null) return;
    const other = side === 1
      ? pairedAmount(raw, BigInt(pool.reserve1), BigInt(pool.reserve2))
      : pairedAmount(raw, BigInt(pool.reserve2), BigInt(pool.reserve1));
    if (other === null) return;
    const shown = formatUnits(other.toString(), side === 1 ? decimals2 : decimals1, side === 1 ? decimals2 : decimals1).replace(/,/g, "");
    const paired = side === 1 ? { ...amounts.current, second: shown } : { ...amounts.current, first: shown };
    amounts.current = paired;
    setAmount1(paired.first);
    setAmount2(paired.second);
  }
}

function rawLpUnits(decimals: number | null): boolean {
  return decimals === null || decimals === 0;
}

function formatLp(balance: string, decimals: number | null): string {
  return decimals === null ? `${balance} base units` : formatUnits(balance, decimals);
}

function previewDeposit(
  pool: PoolView | null,
  amount1: string,
  amount2: string,
  slippage: string,
  decimals: Map<string, number>,
): { min1: bigint; min2: bigint; decimals1: number; decimals2: number } | null {
  if (!pool) return null;
  const decimals1 = assetDecimals(pool.asset1, decimals);
  const decimals2 = assetDecimals(pool.asset2, decimals);
  if (decimals1 === null || decimals2 === null) return null;
  const desired1 = parseDecimalToPlanck(amount1, decimals1);
  const desired2 = parseDecimalToPlanck(amount2, decimals2);
  if (!desired1 || !desired2) return null;
  const reserve1 = pool.reserve1 && /^\d+$/.test(pool.reserve1.replace(/,/g, "")) ? BigInt(pool.reserve1.replace(/,/g, "")) : null;
  const reserve2 = pool.reserve2 && /^\d+$/.test(pool.reserve2.replace(/,/g, "")) ? BigInt(pool.reserve2.replace(/,/g, "")) : null;
  const deposit = optimalDeposit(desired1, desired2, reserve1, reserve2);
  if (!deposit) return null;
  const min1 = applySlippage(deposit.amount1, slippage);
  const min2 = applySlippage(deposit.amount2, slippage);
  if (min1 === null || min2 === null || min1 <= BigInt(0) || min2 <= BigInt(0)) return null;
  return { min1, min2, decimals1, decimals2 };
}

function DepositMinimum({
  pool,
  preview,
  symbols,
}: {
  pool: PoolView;
  preview: { min1: bigint; min2: bigint; decimals1: number; decimals2: number } | null;
  symbols: Map<string, string>;
}) {
  if (!preview) {
    return <p className="text-xs leading-5 text-faint">Enter both amounts to see the minimum deposit after slippage. The signed call reads the reserves again.</p>;
  }
  return (
    <p className="text-xs leading-5 text-faint">
      Minimum deposit {formatUnits(preview.min1.toString(), preview.decimals1)} {assetLabel(pool.asset1, symbols)} and {formatUnits(preview.min2.toString(), preview.decimals2)} {assetLabel(pool.asset2, symbols)}. The signed call reads the reserves again and can differ.
    </p>
  );
}

function reserveText(pool: PoolView, maps: { symbols: Map<string, string>; decimals: Map<string, number> }): string {
  if (pool.reserve1 === null || pool.reserve2 === null) return "Reserves unavailable.";
  const left = assetDecimals(pool.asset1, maps.decimals);
  const right = assetDecimals(pool.asset2, maps.decimals);
  if (left === null || right === null) return "Reserves were read, but decimals are unavailable.";
  return `Reserves ${formatUnits(pool.reserve1, left)} ${assetLabel(pool.asset1, maps.symbols)} and ${formatUnits(pool.reserve2, right)} ${assetLabel(pool.asset2, maps.symbols)}.`;
}

function AssetPicker({
  label,
  value,
  assets,
  onChange,
}: {
  label: string;
  value: AssetRef;
  assets: { id: string; symbol: string }[] | null;
  onChange: (asset: AssetRef) => void;
}) {
  const selected = assetKey(value);
  return (
    <label className="block text-xs text-muted">
      {label}
      <select
        className={`${FIELD} mt-1.5`}
        value={selected}
        onChange={(event) => onChange(parseChoice(event.target.value))}
      >
        <option value="native">{NATIVE_SYMBOL}</option>
        {(assets ?? []).map((asset) => (
          <option key={asset.id} value={`asset:${asset.id}`}>
            {asset.symbol} #{asset.id}
          </option>
        ))}
      </select>
    </label>
  );
}

function assetBalance(
  asset: AssetRef,
  free: bigint,
  holdings: { id: string; balance: string }[],
): bigint {
  if (asset.kind === "native") return free;
  const row = holdings.find((holding) => holding.id === asset.id);
  const digits = row?.balance.replace(/,/g, "") ?? "0";
  return /^\d+$/.test(digits) ? BigInt(digits) : BigInt(0);
}

function shownAmount(amount: bigint, decimals: number, label: string): string {
  return `${formatUnits(amount.toString(), decimals)} ${label}`;
}

function parseChoice(value: string): AssetRef {
  if (value === "native") return { kind: "native" };
  return { kind: "asset", id: value.replace("asset:", "") };
}

function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input className={`${FIELD} mt-1.5 font-mono`} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Slippage({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex gap-2">
      {["0.1", "0.5", "1"].map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={value === item}
          onClick={() => onChange(item)}
          className={`rounded-md border px-3 py-1.5 text-sm ${value === item ? "border-violet" : "border-line text-muted"}`}
        >
          {item}%
        </button>
      ))}
    </div>
  );
}

function useAssetMaps() {
  const chain = useChain();
  return useMemo(() => {
    const symbols = new Map<string, string>();
    const decimals = new Map<string, number>();
    for (const asset of chain.assets ?? []) {
      symbols.set(asset.id, asset.symbol);
      if (asset.decimals !== null) decimals.set(asset.id, asset.decimals);
    }
    return { symbols, decimals };
  }, [chain.assets]);
}

async function injectedSigner(source: string) {
  const { web3FromSource } = await import("@polkadot/extension-dapp");
  const injected = await web3FromSource(source);
  if (!injected.signer) throw new Error("This wallet did not provide a signer.");
  return injected;
}
