"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, ArrowDownUp, ArrowUpRight, Coins, ShieldCheck } from "lucide-react";
import { useChain } from "@/components/chain/chain-provider";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { Button, PageIntro, Panel } from "@/components/ui";
import { useWalletOperation } from "@/components/wallet/use-wallet-operation";
import { readAssetMinBalance } from "@/lib/chain-read";
import { errorText, formatUnits, parseDecimalToPlanck, positiveAmountError } from "@/lib/format";
import { TransactionReview } from "@/components/transaction-review";
import { receiptExplorerUrl } from "@/lib/explorer";
import { assetRemainder, swapQuoteKey } from "@/lib/liquidity-math";
import { reviewExtrinsic } from "@/lib/preflight";
import { QUOTE_EXPIRY_MS, WALLET_MOVE_WARNING, quoteExpired, swapStillExecutable } from "@/lib/quote-window";
import { outcomeWithoutHash, txResultMessage } from "@/lib/tx-result";
import {
  applySlippage,
  assetDecimals,
  assetLabel,
  balanceDigits,
  buildSwapExactIn,
  poolLabel,
  quoteForSwap,
  readPoolPosition,
  reservePaysSwap,
  reservesUsable,
  sameAsset,
  type AssetRef,
  type PoolView,
} from "@/lib/pools";

const FIELD = "h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-sm";

export function SwapScreen() {
  const chain = useChain();
  const wallet = useSubstrateWallet();
  const txs = useTxs();
  const signer = wallet.selected;
  const maps = useMemo(() => {
    const symbols = new Map<string, string>();
    const decimals = new Map<string, number>();
    for (const asset of chain.assets ?? []) {
      symbols.set(asset.id, asset.symbol);
      if (asset.decimals !== null) decimals.set(asset.id, asset.decimals);
    }
    return { symbols, decimals };
  }, [chain.assets]);
  const pools = chain.pools;
  const [poolLp, setPoolLp] = useState<string | null>(null);
  const [flip, setFlip] = useState(false);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [quote, setQuote] = useState<{ key: string; out: string } | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "reading" | "none" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [quotedAt, setQuotedAt] = useState<number | null>(null);
  const [expiredKey, setExpiredKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [costReview, setCostReview] = useState<{ fee: string; budget: string; total: string; expires: number; minimum: string } | null>(null);
  const [receipt, setReceipt] = useState<{ hash: string; block?: number } | null>(null);
  const [funding, setFunding] = useState<{key:string; error:string|null} | null>(null);
  const [fundingRefresh, setFundingRefresh] = useState(0);
  const approval = useRef<((accepted: boolean) => void) | null>(null);
  function closeReview(accepted: boolean) { approval.current?.(accepted); approval.current = null; setCostReview(null); }
  useEffect(() => () => { approval.current?.(false); }, []);
  useEffect(() => { closeReview(false); }, [signer?.address, poolLp, flip, amount, slippage]);
  useEffect(() => { setMessage(null); }, [amount, flip, poolLp, signer?.address]);
  useEffect(() => {
    if (chain.status !== "live") return;
    let cancelled = false, retry: ReturnType<typeof setTimeout> | undefined;
    void Promise.allSettled([chain.refreshPools(), chain.refreshAssets()]).then(results => {
      if (!cancelled && results.some(result => result.status === "rejected")) retry = setTimeout(() => {
        if (!cancelled) void Promise.allSettled([chain.refreshPools(), chain.refreshAssets()]);
      }, 1500);
    });
    return () => { cancelled = true; clearTimeout(retry); };
  }, [chain.status, chain.refreshPools, chain.refreshAssets]);


  const pool = pools?.find((item) => item.lpToken === poolLp) ?? pools?.[0] ?? null;
  const { signAndSend, current: operationCurrent } = useWalletOperation({ pool: pool?.lpToken, flip, amount, slippage });
  const assetIn = pool ? (flip ? pool.asset2 : pool.asset1) : null;
  const assetOut = pool ? (flip ? pool.asset1 : pool.asset2) : null;
  const decimalsIn = assetIn ? assetDecimals(assetIn, maps.decimals) : null;
  const amountIn = decimalsIn === null ? null : parseDecimalToPlanck(amount, decimalsIn);
  const amountError = amount.trim() && decimalsIn !== null ? positiveAmountError(amount, decimalsIn) : null;
  const usable = pool ? reservesUsable(pool) : false;
  const quoteKey =
    pool && amountIn && amountIn > BigInt(0)
      ? swapQuoteKey(pool.lpToken, flip, amountIn.toString(), null)
      : "";
  const liveQuote = quote && quote.key === quoteKey && quoteState === "ready" ? quote.out : null;

  useEffect(() => {
    setAmount("");
  }, [pool?.lpToken]);

  useEffect(() => {
    const api = chain.getApi();
    if (!quoteKey) {
      setQuote(null);
      setQuotedAt(null);
      setExpiredKey(null);
      setQuoteState(usable ? "idle" : "none");
      return;
    }
    if (expiredKey && expiredKey !== quoteKey) setExpiredKey(null);
    if (!api || !pool || !assetIn || !assetOut || !usable || !amountIn || expiredKey === quoteKey) {
      return;
    }
    let cancelled = false;
    setQuoteState("reading");
    const timer = window.setTimeout(() => {
      void quoteForSwap(api, assetIn, assetOut, amountIn)
        .then((next) => {
          if (cancelled) return;
          setQuote(next ? { key: quoteKey, out: next.amount } : null);
          setQuotedAt(next ? Date.now() : null);
          setQuoteState(next ? "ready" : "none");
        })
        .catch(() => {
          if (!cancelled) {
            setQuote(null);
            setQuoteState("error");
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [amountIn, assetIn, assetOut, chain.getApi, expiredKey, pool, quoteKey, usable]);

  const minimum = liveQuote && /^\d+$/.test(liveQuote) ? applySlippage(BigInt(liveQuote), slippage) : null;
  const fundingKey = signer && quoteKey && minimum !== null ? `${quoteKey}:${signer.address}:${signer.source}:${wallet.getVersion()}:${minimum}:${fundingRefresh}` : "";
  const fundingChecked = !!fundingKey && funding?.key === fundingKey;
  const fundingError = fundingChecked ? funding?.error : null;
  const settled = txs.items.filter(row => row.account === signer?.address && ["finalized", "failed"].includes(row.status)).map(row => `${row.id}:${row.status}`).join("|");
  useEffect(() => {
    setFunding(null);
    const api = chain.getApi();
    if (!api || chain.status !== "live" || !signer || !assetIn || !assetOut || !amountIn || !minimum || !fundingKey || amountError) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const tx = buildSwapExactIn(api, assetIn, assetOut, amountIn, minimum, signer.address);
        const review = await reviewExtrinsic(api, tx, signer.address, [assetIn.kind === "native" ? amountIn : 0n]);
        let error: string | null = review.ok ? null : review.message;
        if (review.ok && assetIn.kind === "asset") {
          const at = await api.at(review.blockHash);
          const holding = await at.query.assets.account(assetIn.id, signer.address) as unknown as {isNone:boolean;unwrap():{balance:{toString():string}}};
          const balance = holding.isNone ? 0n : BigInt(holding.unwrap().balance.toString());
          const minimumBalance = await readAssetMinBalance(api, assetIn.id, review.blockHash);
          if (minimumBalance === null) error = "The token minimum balance is unavailable. Refresh the balance check.";
          else {
            const remainder = assetRemainder(balance, amountIn, minimumBalance);
            if (remainder === "short") error = "Not enough token balance for this swap.";
            if (remainder === "dust") error = "This swap would leave the token below its minimum balance.";
          }
        }
        if (!cancelled) setFunding({key:fundingKey,error});
      })().catch(() => { if (!cancelled) setFunding({key:fundingKey,error:"Balance and network fee could not be checked. Refresh the balance check before swapping."}); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [fundingKey, chain.status, chain.getApi, assetIn, assetOut, amountIn, minimum, signer?.address, signer?.source, amountError, settled]);
  const quoteSecondsLeft = quotedAt === null ? null : Math.max(0, Math.ceil((QUOTE_EXPIRY_MS - (now - quotedAt)) / 1000));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (quotedAt === null) return;
    const delay = quotedAt + QUOTE_EXPIRY_MS - Date.now();
    const clear = () => {
      setQuote(null);
      setQuotedAt(null);
      setQuoteState("idle");
      setExpiredKey(quoteKey);
      setMessage(null);
    };
    if (delay <= 0) {
      clear();
      return;
    }
    const timer = window.setTimeout(clear, delay);
    return () => window.clearTimeout(timer);
  }, [quoteKey, quotedAt]);

  async function minimumReserveMessage(api: NonNullable<ReturnType<typeof chain.getApi>>, current: PoolView, assetOut: AssetRef): Promise<string> {
    const fallback = "The node did not return a quote for this amount, so nothing was signed.";
    if (assetOut.kind !== "asset") return fallback;
    try {
      const [minimum, position] = await Promise.all([
        readAssetMinBalance(api, assetOut.id),
        readPoolPosition(api, current.asset1, current.asset2, current.lpToken),
      ]);
      const reserve = sameAsset(current.asset1, assetOut) ? position.reserve1 : sameAsset(current.asset2, assetOut) ? position.reserve2 : null;
      if (minimum === null || reservePaysSwap(reserve, minimum) !== false) return fallback;
      const raw = balanceDigits(reserve);
      const decimals = assetDecimals(assetOut, maps.decimals);
      if (!raw || decimals === null) return fallback;
      const symbol = assetLabel(assetOut, maps.symbols);
      return `The pool holds ${formatUnits(raw, decimals)} ${symbol}. Its minimum balance is ${formatUnits(minimum.toString(), decimals)} ${symbol}, so a swap into ${symbol} has no quote until the pool holds more. Nothing was signed.`;
    } catch {
      return fallback;
    }
  }

  async function onSwap() {
    setMessage(null);
    setReceipt(null);
    if (!signer) {
      await wallet.connect();
      return;
    }
    if (!fundingChecked || fundingError) {
      setMessage(fundingError ?? "Wait for the balance and network fee check before swapping.");
      return;
    }
    if (quotedAt === null || quoteExpired(quotedAt, Date.now())) {
      setMessage(`This quote is older than ${QUOTE_EXPIRY_MS / 1000} seconds. Change the amount to request another, then sign.`);
      return;
    }
    if (!pool || !assetIn || !assetOut || !usable || !amountIn || !liveQuote || !minimum || minimum <= BigInt(0)) {
      setMessage("A swap needs a pool reserve and a quote that matches this amount.");
      return;
    }
    const api = chain.getApi();
    if (!api || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let tracked: string | null = null;
    try {
      const priced = await quoteForSwap(api, assetIn, assetOut, amountIn);
      if (!operationCurrent()) { setMessage("The wallet or swap inputs changed. Review again; nothing was signed."); return; }
      const fresh = priced?.amount ?? null;
      const hash = priced?.blockHash ?? null;
      const freshMin = minimum;
      if (!fresh || !freshMin || freshMin <= BigInt(0)) {
        setQuote(null);
        setQuoteState("none");
        setMessage(await minimumReserveMessage(api, pool, assetOut));
        return;
      }
      if (!swapStillExecutable(BigInt(fresh), freshMin)) {
        setQuote({ key: quoteKey, out: fresh }); setQuotedAt(Date.now()); setQuoteState("ready");
        setMessage("The quote no longer covers the minimum you reviewed. The quote has been refreshed; review it before signing again.");
        return;
      }
      if (assetIn.kind === "asset") {
        const at = hash ? await api.at(hash) : api;
        const stored = (await at.query.assets.account(assetIn.id, signer.address)) as unknown as {
          isNone?: boolean;
          unwrap?: () => { balance?: { toString(): string } };
        };
        const balanceText = stored.isNone ? "0" : stored.unwrap?.().balance?.toString().replace(/,/g, "") ?? "";
        const balance = /^\d+$/.test(balanceText) ? BigInt(balanceText) : null;
        const minBalance = await readAssetMinBalance(api, assetIn.id, hash ?? undefined);
        if (balance === null || minBalance === null) {
          setMessage("The asset balance or minimum balance could not be read, so the wallet was not opened.");
          return;
        }
        const remainder = assetRemainder(balance, amountIn, minBalance);
        if (remainder === "short") {
          setMessage("The asset balance does not cover this swap, so the wallet was not opened.");
          return;
        }
        if (remainder === "dust") {
          setMessage("This swap would leave the asset below its minimum balance. The wallet was not opened.");
          return;
        }
      }
      const tx = buildSwapExactIn(api, assetIn, assetOut, amountIn, freshMin, signer.address);
      const review = await reviewExtrinsic(api, tx, signer.address, [assetIn.kind === "native" ? amountIn : 0n], hash ?? undefined);
      if (!review.ok) {
        setMessage(review.message);
        return;
      }
      const reviewExpires = Date.now() + 30000;
      const accepted = await new Promise<boolean>(resolve => {
        approval.current = resolve;
        setCostReview({ fee: review.estimatedFee.toString(), budget: review.fee.toString(), total: review.nativeNeed.toString(), expires: reviewExpires, minimum: freshMin.toString() });
      });
      if (!accepted) { setMessage(Date.now() >= reviewExpires ? "The cost review expired. Review again. No wallet request was opened." : "Review cancelled. No wallet request was opened."); return; }
      if (!operationCurrent() || Date.now() > reviewExpires) { setMessage("The review expired or inputs changed. Review again."); return; }
      const freshFee = await reviewExtrinsic(api, tx, signer.address, [assetIn.kind === "native" ? amountIn : 0n]);
      if (!freshFee.ok || freshFee.nativeNeed > review.nativeNeed) { setMessage("The balance or fee changed. Review again."); return; }
      const quoteStillCovers = async () => {
        const again = await quoteForSwap(api, assetIn, assetOut, amountIn);
        return again !== null && swapStillExecutable(BigInt(again.amount), freshMin);
      };
      if (!(await quoteStillCovers())) {
        setMessage("The quote no longer covers your minimum. Nothing was submitted.");
        return;
      }
      tracked = crypto.randomUUID();
      txs.push({ id: tracked, label: `Swap ${poolLabel(pool, maps.symbols)}`, status: "signing" });
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injected = await web3FromSource(signer.source);
      if (!injected.signer) throw new Error("This wallet did not provide a signer.");
      const result = await signAndSend(api, review.tx, signer.address, injected.signer, (update) => {
        if (tracked) txs.patch(tracked, update);
      }, undefined, quoteStillCovers);
      if (result.status === "finalized") void chain.refreshPools().catch(() => undefined);
      setMessage(txResultMessage(result.status, result.error));
      if (result.hash) setReceipt({hash: result.hash, block: result.blockNumber});
    } catch (cause) {
      const text = errorText(cause);
      setMessage(text);
      if (tracked) txs.patch(tracked, outcomeWithoutHash(text));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {costReview && <TransactionReview title="Review swap before opening your wallet" expiresAt={costReview.expires} onConfirm={() => closeReview(true)} onCancel={() => closeReview(false)}><p className="break-all text-xs">Recipient: {signer?.address}</p><p className="text-sm">Input: {amount} {assetIn?.kind === "asset" ? `asset #${assetIn.id}` : "tPOT"} · Output: {assetOut?.kind === "asset" ? `asset #${assetOut.id}` : "tPOT"}</p><p className="text-sm">Minimum received: {assetOut && assetDecimals(assetOut, maps.decimals) !== null ? formatUnits(costReview.minimum, assetDecimals(assetOut, maps.decimals)!) : "Unavailable"}</p><p className="text-sm">Estimated network fee: {formatUnits(costReview.fee, 14)} tPOT · Fee budget with reserve: {formatUnits(costReview.budget, 14)} tPOT</p><p className="text-xs text-muted">Total native requirement: {formatUnits(costReview.total, 14)} tPOT. Pool fees are included in the output quote.</p></TransactionReview>}
      <PageIntro
        eyebrow="Swap"
        title="Find your flow."
        body="Swap native assets with a live network quote. Choose your pair, set your slippage, and review the minimum you'll receive before signing."
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Panel className="swap-terminal space-y-5 p-5 sm:p-6">
          <div className="swap-terminal-heading"><span><ArrowDownUp size={16} /> Swap assets</span><span className="swap-testnet-tag">V3 TESTNET</span></div>
          {pools === null ? (
            <p className="text-sm text-muted">
              {chain.status === "connecting" || chain.discovery.pools.loading ? "Reading pools from the testnet…" : "The pool list could not be loaded. Retry discovery."}
              {chain.discovery.pools.error && <span className="mt-2 block text-xs">{chain.discovery.pools.error}</span>}
              <Button className="mt-3" disabled={chain.status !== "live" || chain.discovery.pools.loading} onClick={() => void Promise.allSettled([chain.refreshPools(), chain.refreshAssets()])}>Retry pool discovery</Button>
            </p>
          ) : pools.length === 0 ? (
            <p className="text-sm leading-6 text-muted">
              AssetConversion.pools has 0 records. Create a pool and add reserves before a swap can be quoted.
            </p>
          ) : (
            <>
              <label className="block text-xs text-muted">
                Pool
                <select
                  className={`${FIELD} mt-1.5`}
                  value={pool?.lpToken ?? ""}
                  onChange={(event) => {
                    setPoolLp(event.target.value);
                    setAmount("");
                  }}
                >
                  {pools.map((item) => (
                    <option key={item.lpToken} value={item.lpToken}>
                      {poolLabel(item, maps.symbols)}
                    </option>
                  ))}
                </select>
              </label>
              <Button disabled={chain.status !== "live" || chain.discovery.pools.loading} onClick={() => void Promise.allSettled([chain.refreshPools(), chain.refreshAssets()])}>{chain.discovery.pools.loading ? "Refreshing pools…" : "Refresh pools"}</Button>
              <div className="swap-amount-box"><div className="swap-amount-label"><span>You pay</span><span className="swap-asset-badge"><Coins size={13} />{assetIn ? assetLabel(assetIn, maps.symbols) : "—"}</span></div>
              <input
                aria-label="Amount to swap"
                aria-invalid={!!amountError}
                className="swap-amount-input"
                inputMode="decimal"
                value={amount}
                placeholder="0"
                disabled={!usable}
                onChange={(event) => setAmount(event.target.value)}
              />
              {amountError && <p role="status" className="mt-2 text-xs text-warn">{amountError}</p>}
              <div className="swap-amount-footer"><span>Receive {assetOut ? assetLabel(assetOut, maps.symbols) : "—"}</span><button type="button" aria-label="Switch swap direction" onClick={() => setFlip((value) => !value)}><ArrowDownUp size={13} /> Switch</button></div></div>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-muted">Slippage tolerance</span><div className="flex gap-1.5">
                {["0.1", "0.5", "1"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={slippage === item}
                    onClick={() => setSlippage(item)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[10px] ${slippage === item ? "border-violet bg-violet/10 text-violet" : "border-line text-muted"}`}
                  >
                    {item}%
                  </button>
                ))}
              </div></div>
              {pool ? (
              <QuoteLines
                pool={pool}
                usable={usable}
                quoteState={liveQuote ? "ready" : quoteState === "ready" ? "reading" : quoteState}
                quote={liveQuote}
                minimum={minimum}
                assetOut={assetOut}
                decimals={maps.decimals}
                symbols={maps.symbols}
              />
              ) : null}
              <button
                type="button"
                disabled={busy || !usable || !liveQuote || (!!signer && (!fundingChecked || !!fundingError))}
                onClick={() => void onSwap()}
                className="w-full rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? costReview ? "Review open…" : "Waiting for wallet and chain…" : signer ? "Swap" : "Connect Substrate wallet"}
              </button>
              {signer && liveQuote && <div className="space-y-2 text-xs"><p role="status" className={fundingError ? "text-warn" : "text-muted"}>{fundingError ?? (fundingChecked ? "Balance and network fee checked. They are checked again before signing." : "Checking available balance and network fee…")}</p><button type="button" className="text-violet underline" disabled={busy} onClick={() => setFundingRefresh(n=>n+1)}>Refresh balance check</button></div>}
              <p className="text-xs leading-5 text-faint">
                {expiredKey === quoteKey && quoteKey
                  ? "This quote has expired. Change the amount to request another."
                  : quoteSecondsLeft === null
                    ? "A quote lasts 30 seconds. Change the amount after it expires to request another."
                    : `Quote expires in ${quoteSecondsLeft}s. A signature can still be sent after that if the new quote covers the minimum.`}
              </p>
              <p className="text-xs leading-5 text-faint">{WALLET_MOVE_WARNING}</p>
              {!signer && usable ? (
                <p className="text-xs text-faint">The button stays off until a quote exists. Connecting does not submit the swap.</p>
              ) : null}
            </>
          )}
          {receipt && <div className="space-y-2 text-xs"><p className="break-all font-mono">Transaction {receipt.hash}</p><p>{receipt.block === undefined ? "Block lookup unavailable; inspect Activity." : `Block ${receipt.block}`}</p><a className="text-violet underline" href={receiptExplorerUrl(receipt.hash) ?? "#"} target="_blank" rel="noreferrer">Inspect transaction ↗</a></div>}
          {wallet.error ? <p className="text-sm text-warn">{wallet.error}</p> : null}
          {message ? <p className="text-sm text-warn">{message}</p> : null}
        </Panel>
        <div className="space-y-4"><Panel className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-xs font-medium">Pool snapshot</h2><Link href="/liquidity" className="inline-flex items-center gap-1 text-[10px] text-violet">Manage liquidity <ArrowUpRight size={12} /></Link></div><div className="mt-5 grid grid-cols-2 gap-3">{pool ? [pool.asset1, pool.asset2].map((asset, index) => { const decimals = assetDecimals(asset, maps.decimals); const reserve = index === 0 ? pool.reserve1 : pool.reserve2; return <div key={index} className="swap-reserve-card"><span>{assetLabel(asset, maps.symbols)} reserves</span><strong>{reserve !== null && decimals !== null ? formatUnits(reserve, decimals) : "—"}</strong></div>; }) : <p className="col-span-2 text-xs text-muted">Choose an available pool to see its reserves.</p>}</div><p className="mt-4 flex items-center gap-2 text-[9px] text-faint"><ShieldCheck size={12} className="text-ok" /> Reserves read from the network. Quotes include the pool fee.</p></Panel><Panel className="p-5 sm:p-6"><h2 className="text-xs font-medium">Price history</h2><div className="swap-chart-empty"><span><Activity size={26} strokeWidth={1.3} /></span><h3>A fuller picture, in time.</h3><p>Trade history hasn&apos;t been indexed yet.<br />Your live swap quote is available in the terminal.</p></div></Panel></div>
      </div>
    </div>
  );
}

function QuoteLines({
  pool,
  usable,
  quoteState,
  quote,
  minimum,
  assetOut,
  decimals,
  symbols,
}: {
  pool: PoolView;
  usable: boolean;
  quoteState: string;
  quote: string | null;
  minimum: bigint | null;
  assetOut: AssetRef | null;
  decimals: Map<string, number>;
  symbols: Map<string, string>;
}) {
  const outDecimals = assetOut ? assetDecimals(assetOut, decimals) : null;
  let quoteText = "Unavailable";
  if (!usable) quoteText = "No usable reserves";
  else if (quoteState === "reading") quoteText = "Reading the node…";
  else if (quoteState === "none") quoteText = "No quote";
  else if (quoteState === "error") quoteText = "Quote failed";
  else if (quote && outDecimals !== null) quoteText = formatUnits(quote, outDecimals);
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-muted">Reserves</dt>
        <dd className="text-right text-faint">
          {pool.reserve1 === null || pool.reserve2 === null ? "Unavailable" : usable ? "On chain" : "Empty"}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted">Expected out</dt>
        <dd className="font-mono">{quoteText}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted">Minimum received</dt>
        <dd className="font-mono">
          {minimum && outDecimals !== null ? formatUnits(minimum.toString(), outDecimals) : "Unavailable"}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted">Receive</dt>
        <dd>{assetOut ? assetLabel(assetOut, symbols) : "—"}</dd>
      </div>
    </dl>
  );
}
