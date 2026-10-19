"use client";

import { useEffect, useMemo, useState } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { PageIntro, Panel } from "@/components/ui";
import { signAndSend } from "@/lib/assets";
import { errorText, formatUnits, parseDecimalToPlanck } from "@/lib/format";
import { swapQuoteKey } from "@/lib/liquidity-math";
import { txResultMessage } from "@/lib/tx-result";
import {
  applySlippage,
  assetDecimals,
  assetLabel,
  buildSwapExactIn,
  poolLabel,
  quoteExactIn,
  reservesUsable,
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
  const [poolIndex, setPoolIndex] = useState(0);
  const [flip, setFlip] = useState(false);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [quote, setQuote] = useState<{ key: string; out: string } | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "reading" | "none" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pool = pools?.[poolIndex] ?? null;
  const assetIn = pool ? (flip ? pool.asset2 : pool.asset1) : null;
  const assetOut = pool ? (flip ? pool.asset1 : pool.asset2) : null;
  const decimalsIn = assetIn ? assetDecimals(assetIn, maps.decimals) : null;
  const amountIn = decimalsIn === null ? null : parseDecimalToPlanck(amount, decimalsIn);
  const usable = pool ? reservesUsable(pool) : false;
  const quoteKey =
    pool && amountIn && amountIn > BigInt(0)
      ? swapQuoteKey(pool.lpToken, flip, amountIn.toString(), chain.blockNumber)
      : "";
  const liveQuote = quote && quote.key === quoteKey && quoteState === "ready" ? quote.out : null;

  useEffect(() => {
    const api = chain.getApi();
    if (!api || !pool || !assetIn || !assetOut || !usable || !quoteKey || !amountIn) {
      setQuote(null);
      setQuoteState(usable ? "idle" : "none");
      return;
    }
    let cancelled = false;
    setQuoteState("reading");
    const timer = window.setTimeout(() => {
      void quoteExactIn(api, assetIn, assetOut, amountIn)
        .then((next) => {
          if (cancelled) return;
          setQuote(next ? { key: quoteKey, out: next } : null);
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
  }, [amountIn, assetIn, assetOut, chain.getApi, pool, quoteKey, usable]);

  const minimum = liveQuote && /^\d+$/.test(liveQuote) ? applySlippage(BigInt(liveQuote), slippage) : null;

  async function onSwap() {
    setMessage(null);
    if (!signer) {
      await wallet.connect();
      return;
    }
    if (!pool || !assetIn || !assetOut || !usable || !amountIn || !liveQuote || !minimum || minimum <= BigInt(0)) {
      setMessage("A swap needs a pool reserve and a quote that matches this amount.");
      return;
    }
    const api = chain.getApi();
    if (!api) return;
    const fresh = await quoteExactIn(api, assetIn, assetOut, amountIn);
    const freshMin = fresh && /^\d+$/.test(fresh) ? applySlippage(BigInt(fresh), slippage) : null;
    if (!freshMin || freshMin <= BigInt(0)) {
      setQuote(null);
      setQuoteState("none");
      setMessage("The node did not return a quote for this amount, so nothing was signed.");
      return;
    }
    const id = crypto.randomUUID();
    setBusy(true);
    txs.push({ id, label: `Swap ${poolLabel(pool, maps.symbols)}`, status: "signing" });
    try {
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injected = await web3FromSource(signer.source);
      if (!injected.signer) throw new Error("This wallet did not provide a signer.");
      const tx = buildSwapExactIn(api, assetIn, assetOut, amountIn, freshMin, signer.address);
      const result = await signAndSend(api, tx, signer.address, injected.signer, (update) => txs.patch(id, update));
      if (result.status === "finalized") await chain.refreshPools().catch(() => undefined);
      setMessage(txResultMessage(result.status, result.error));
    } catch (cause) {
      const text = errorText(cause);
      setMessage(text);
      txs.patch(id, { status: "failed", error: text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Swap"
        title="Trade against a real pool"
        body="The quote comes from AssetConversion.quotePriceExactTokensForTokens and includes the pool fee. If the node returns no quote, this screen does not invent a price."
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Panel className="space-y-4 p-4">
          {pools === null ? (
            <p className="text-sm text-muted">The pool list is unavailable.</p>
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
                  value={poolIndex}
                  onChange={(event) => setPoolIndex(Number(event.target.value))}
                >
                  {pools.map((item, index) => (
                    <option key={item.lpToken} value={index}>
                      {poolLabel(item, maps.symbols)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center justify-between text-sm">
                <span>{assetIn ? assetLabel(assetIn, maps.symbols) : "Pay"} to {assetOut ? assetLabel(assetOut, maps.symbols) : "receive"}</span>
                <button type="button" className="text-blue" onClick={() => setFlip((value) => !value)}>
                  Switch direction
                </button>
              </div>
              <input
                className={FIELD}
                inputMode="decimal"
                value={amount}
                placeholder="0"
                disabled={!usable}
                onChange={(event) => setAmount(event.target.value)}
              />
              <div className="flex gap-2">
                {["0.1", "0.5", "1"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={slippage === item}
                    onClick={() => setSlippage(item)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${slippage === item ? "border-violet" : "border-line text-muted"}`}
                  >
                    {item}%
                  </button>
                ))}
              </div>
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
                disabled={busy || !usable || !liveQuote}
                onClick={() => void onSwap()}
                className="w-full rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Waiting for the wallet…" : signer ? "Swap" : "Connect Substrate wallet"}
              </button>
              {!signer && usable ? (
                <p className="text-xs text-faint">The button stays off until a quote exists. Connecting does not submit the swap.</p>
              ) : null}
            </>
          )}
          {wallet.error ? <p className="text-sm text-warn">{wallet.error}</p> : null}
          {message ? <p className="text-sm text-warn">{message}</p> : null}
        </Panel>
        <Panel className="flex min-h-64 flex-col p-4">
          <h2 className="text-sm font-medium">Price chart</h2>
          <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line px-6 py-10 text-center">
            <p className="max-w-sm text-sm leading-6 text-muted">
              No trade history is indexed. A chart is not drawn from a single quote.
            </p>
          </div>
        </Panel>
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
