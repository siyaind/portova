"use client";

import { useEffect, useMemo, useState } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { PageIntro, Panel, StatusPill } from "@/components/ui";
import { signAndSend } from "@/lib/assets";
import { optimalDeposit } from "@/lib/liquidity-math";
import { txResultMessage } from "@/lib/tx-result";
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
  readLpBalance,
  readPoolConstants,
  reservesUsable,
  sameAsset,
  type AssetRef,
  type PoolConstants,
  type PoolView,
} from "@/lib/pools";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";

const FIELD =
  "h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink";
export function LiquidityScreen() {
  const chain = useChain();
  const wallet = useSubstrateWallet();
  const txs = useTxs();
  const signer = wallet.selected;
  const maps = useAssetMaps();
  const [constants, setConstants] = useState<PoolConstants | null>(null);
  const [left, setLeft] = useState<AssetRef>({ kind: "native" });
  const [right, setRight] = useState<AssetRef>({ kind: "asset", id: chain.assets?.[0]?.id ?? "1" });
  const [poolIndex, setPoolIndex] = useState(0);
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [lpBalance, setLpBalance] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pool = chain.pools?.[poolIndex] ?? null;

  useEffect(() => {
    const api = chain.getApi();
    if (chain.status !== "live" || !api) return;
    setConstants(readPoolConstants(api));
  }, [chain, chain.status]);

  useEffect(() => {
    if (chain.assets?.[0] && right.kind === "asset" && right.id === "1" && !chain.assets.some((asset) => asset.id === "1")) {
      setRight({ kind: "asset", id: chain.assets[0].id });
    }
  }, [chain.assets, right]);

  useEffect(() => {
    const api = chain.getApi();
    if (!api || !signer || !pool) {
      setLpBalance(null);
      return;
    }
    let cancelled = false;
    void readLpBalance(api, pool.lpToken, signer.address)
      .then((balance) => {
        if (!cancelled) setLpBalance(balance);
      })
      .catch(() => {
        if (!cancelled) setLpBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [chain, pool, signer]);

  async function sign(
    label: string,
    build: (api: NonNullable<ReturnType<typeof chain.getApi>>) => ReturnType<typeof buildCreatePool>,
    refresh = true,
  ) {
    setMessage(null);
    if (!signer) {
      await wallet.connect();
      return;
    }
    const api = chain.getApi();
    if (!api) return;
    const id = crypto.randomUUID();
    setBusy(label);
    txs.push({ id, label, status: "signing" });
    try {
      const result = await signAndSend(api, build(api), signer.address, (await injectedSigner(signer.source)).signer, (update) =>
        txs.patch(id, update),
      );
      if (result.status === "finalized" || result.status === "included") {
        if (refresh) await chain.refreshPools().catch(() => undefined);
      }
      setMessage(txResultMessage(result.status, result.error));
    } catch (cause) {
      const text = errorText(cause);
      setMessage(text);
      txs.patch(id, { status: "failed", error: text });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Liquidity"
        title="Pools on AssetConversion"
        body="Pools, deposits, and withdrawals use the runtime pallet. PORTOVA does not deploy an AMM. Each action is its own signature. A swap quote appears only after a pool reports reserves."
      />
      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Stored pools</h2>
          <StatusPill tone={chain.pools === null ? "warn" : chain.poolCount === 0 ? "muted" : "ok"}>
            {chain.poolCount === null ? "Count unavailable" : `${chain.poolCount} on chain`}
          </StatusPill>
        </div>
        {chain.pools === null ? (
          <p className="mt-3 text-sm text-muted">The pool list is unavailable.</p>
        ) : chain.pools.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            AssetConversion.pools has 0 records. There is no reserve, price, or LP balance to show.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {chain.pools.map((item, index) => (
              <li key={item.lpToken}>
                <button
                  type="button"
                  onClick={() => setPoolIndex(index)}
                  className={`w-full rounded-lg border px-3 py-3 text-left ${
                    index === poolIndex ? "border-violet" : "border-line"
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
            Setup fee {constants ? `${formatUnits(constants.poolSetupFee, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}` : "unavailable"}, paid in {constants?.poolSetupFeeAsset ?? "the native token"}. Swap fee {constants?.lpFee ?? "unavailable"}. This call does not add liquidity.
          </p>
          <AssetPicker label="First asset" value={left} assets={chain.assets} onChange={setLeft} />
          <AssetPicker label="Second asset" value={right} assets={chain.assets} onChange={setRight} />
          {sameAsset(left, right) ? <p className="text-sm text-warn">Choose two different assets.</p> : null}
          {wallet.error ? <p className="text-sm text-warn">{wallet.error}</p> : null}
          <button
            type="button"
            disabled={Boolean(busy) || chain.status !== "live" || sameAsset(left, right)}
            onClick={() =>
              void sign(`Create pool`, (api) => buildCreatePool(api, left, right))
            }
            className="w-full rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "Create pool" ? "Waiting for the wallet…" : signer ? "Create pool" : "Connect Substrate wallet"}
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
                onChange={setAmount1}
              />
              <AmountField
                label={assetLabel(pool.asset2, maps.symbols)}
                value={amount2}
                onChange={setAmount2}
              />
              <Slippage value={slippage} onChange={setSlippage} />
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void submitAdd()}
                className="w-full rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "Add liquidity" ? "Waiting for the wallet…" : signer ? "Add liquidity" : "Connect Substrate wallet"}
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">Create a pool before a deposit can be built.</p>
          )}
        </Panel>
      </div>

      <Panel className="space-y-4 p-4">
        <h2 className="text-sm font-medium">Remove liquidity</h2>
        {!signer ? (
          <p className="text-sm text-muted">Connect a Substrate wallet to read an LP balance.</p>
        ) : !pool ? (
          <p className="text-sm text-muted">No pool is selected.</p>
        ) : lpBalance === null ? (
          <p className="text-sm text-muted">LP balance is unavailable.</p>
        ) : lpBalance === "0" ? (
          <p className="text-sm text-muted">This account has no LP token #{pool.lpToken}.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Balance {formatLp(lpBalance, pool.lpDecimals)} of LP #{pool.lpToken}. Withdrawal fee {constants?.withdrawalFee ?? "unavailable"}.
            </p>
            <AmountField label="LP tokens to burn" value={lpAmount} onChange={setLpAmount} />
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void submitRemove()}
              className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50"
            >
              {busy === "Remove liquidity" ? "Waiting for the wallet…" : "Remove liquidity"}
            </button>
          </>
        )}
        {message ? <p className="text-sm leading-6 text-warn">{message}</p> : null}
      </Panel>
    </div>
  );

  async function submitAdd() {
    if (!pool || !signer) {
      await wallet.connect();
      return;
    }
    const decimals1 = assetDecimals(pool.asset1, maps.decimals);
    const decimals2 = assetDecimals(pool.asset2, maps.decimals);
    if (decimals1 === null || decimals2 === null) {
      setMessage("Decimals for one side are unavailable, so the deposit was not built.");
      return;
    }
    const desired1 = parseDecimalToPlanck(amount1, decimals1);
    const desired2 = parseDecimalToPlanck(amount2, decimals2);
    if (!desired1 || !desired2) {
      setMessage("Enter amounts that stay above zero after slippage.");
      return;
    }
    const reserve1 = pool.reserve1 && /^\d+$/.test(pool.reserve1) ? BigInt(pool.reserve1) : null;
    const reserve2 = pool.reserve2 && /^\d+$/.test(pool.reserve2) ? BigInt(pool.reserve2) : null;
    const deposit = optimalDeposit(desired1, desired2, reserve1, reserve2);
    const min1 = deposit ? applySlippage(deposit.amount1, slippage) : null;
    const min2 = deposit ? applySlippage(deposit.amount2, slippage) : null;
    if (!deposit || !min1 || !min2 || min1 <= BigInt(0) || min2 <= BigInt(0)) {
      setMessage("The reserve ratio does not produce a deposit above zero, so nothing was signed.");
      return;
    }
    await sign("Add liquidity", (api) =>
      buildAddLiquidity(api, pool, deposit.amount1, deposit.amount2, min1, min2, signer.address),
    );
  }

  async function submitRemove() {
    if (!pool || !signer || !lpBalance) return;
    const raw = pool.lpDecimals === null ? ( /^\d+$/.test(lpAmount.trim()) ? BigInt(lpAmount.trim()) : null ) : parseDecimalToPlanck(lpAmount, pool.lpDecimals);
    if (raw === null || raw <= BigInt(0) || raw > BigInt(lpBalance)) {
      setMessage("Enter an LP amount you hold.");
      return;
    }
    const min1 = withdrawalMin(pool.reserve1, pool.lpSupply, raw, slippage);
    const min2 = withdrawalMin(pool.reserve2, pool.lpSupply, raw, slippage);
    if (min1 === null || min2 === null) {
      setMessage("Reserves or LP supply are unavailable, so a minimum receive amount was not invented.");
      return;
    }
    await sign("Remove liquidity", (api) =>
      buildRemoveLiquidity(api, pool, raw, min1, min2, signer.address),
    );
  }
}

function withdrawalMin(
  reserve: string | null,
  supply: string | null,
  burn: bigint,
  slippage: string,
): bigint | null {
  if (!reserve || !supply || !/^\d+$/.test(reserve) || !/^\d+$/.test(supply)) return null;
  const supplyRaw = BigInt(supply);
  if (supplyRaw <= BigInt(0)) return null;
  const expected = (BigInt(reserve) * burn) / supplyRaw;
  return applySlippage(expected, slippage);
}

function formatLp(balance: string, decimals: number | null): string {
  return decimals === null ? `${balance} base units` : formatUnits(balance, decimals);
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