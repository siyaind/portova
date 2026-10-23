"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { PageIntro, Panel, StatusPill } from "@/components/ui";
import { signAndSend } from "@/lib/assets";
import { optimalDeposit, pairedAmount } from "@/lib/liquidity-math";
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
  readLpBalance,
  readPoolConstants,
  readReserves,
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
  const [poolLp, setPoolLp] = useState<string | null>(null);
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [lpBalance, setLpBalance] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const amounts = useRef({ first: "", second: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const pool = chain.pools?.find((item) => item.lpToken === poolLp) ?? chain.pools?.[0] ?? null;

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

  useEffect(() => {
    setAddMessage(null);
  }, [signer?.address]);

  async function sign(
    label: string,
    build: (api: NonNullable<ReturnType<typeof chain.getApi>>) => ReturnType<typeof buildCreatePool>,
    refresh = true,
    place: "add" | "other" = "other",
  ) {
    const report = place === "add" ? setAddMessage : setMessage;
    report(null);
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
      report(txResultMessage(result.status, result.error));
    } catch (cause) {
      const text = errorText(cause);
      report(text);
      txs.patch(id, outcomeWithoutHash(text));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Liquidity"
        title="Bring your assets together."
        body="Create a pool, manage your deposits, and withdraw liquidity from your wallet. Every action is a separate signature, with reserves and fees read from the network."
      />
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
            AssetConversion.pools has 0 records. There is no reserve, price, or LP balance to show.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {chain.pools.map((item) => (
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
                onChange={(value) => fillFromReserves(1, value)}
              />
              <AmountField
                label={assetLabel(pool.asset2, maps.symbols)}
                value={amount2}
                onChange={(value) => fillFromReserves(2, value)}
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
              {addMessage ? <p className="text-sm leading-6 text-warn">{addMessage}</p> : null}
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
    const spendable = snapshot.spendable?.replace(/,/g, "") ?? "";
    if (snapshot.error || !/^\d+$/.test(spendable)) {
      setAddMessage(snapshot.error ?? "The spendable balance could not be read, so the wallet was not opened.");
      return;
    }
    const have1 = assetBalance(pool.asset1, BigInt(spendable), snapshot.holdings);
    const have2 = assetBalance(pool.asset2, BigInt(spendable), snapshot.holdings);
    const name1 = assetLabel(pool.asset1, maps.symbols);
    const name2 = assetLabel(pool.asset2, maps.symbols);
    const short = [desired1 > have1 ? name1 : null, desired2 > have2 ? name2 : null].filter((name): name is string => Boolean(name));
    if (short.length > 0) {
      const verb = short.length > 1 ? "are short" : "is short";
      setAddMessage(
        `${short.join(" and ")} ${verb}. This deposit asks for ${shownAmount(desired1, decimals1, name1)} and ${shownAmount(desired2, decimals2, name2)}. This account has ${shownAmount(have1, decimals1, name1)} and ${shownAmount(have2, decimals2, name2)}. The wallet was not opened.`,
      );
      return;
    }
    setAddMessage(null);
    const api = chain.getApi();
    if (!api) {
      setAddMessage("The testnet connection is unavailable, so the wallet was not opened.");
      return;
    }
    let fresh1: string | null = null;
    let fresh2: string | null = null;
    try {
      [fresh1, fresh2] = await readReserves(api, pool.asset1, pool.asset2);
    } catch (cause) {
      setAddMessage(errorText(cause));
      return;
    }
    const reserve1 = fresh1 && /^\d+$/.test(fresh1.replace(/,/g, "")) ? BigInt(fresh1.replace(/,/g, "")) : null;
    const reserve2 = fresh2 && /^\d+$/.test(fresh2.replace(/,/g, "")) ? BigInt(fresh2.replace(/,/g, "")) : null;
    const deposit = optimalDeposit(desired1, desired2, reserve1, reserve2);
    const min1 = deposit ? applySlippage(deposit.amount1, slippage) : null;
    const min2 = deposit ? applySlippage(deposit.amount2, slippage) : null;
    if (!deposit || !min1 || !min2 || min1 <= BigInt(0) || min2 <= BigInt(0)) {
      setAddMessage("The reserve ratio does not produce a deposit above zero, so nothing was signed.");
      return;
    }
    await sign(
      "Add liquidity",
      (api) => buildAddLiquidity(api, pool, deposit.amount1, deposit.amount2, min1, min2, signer.address),
      true,
      "add",
    );
  }

  async function submitRemove() {
    if (!pool || !signer || !lpBalance) return;
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
    let fresh1: string | null = null;
    let fresh2: string | null = null;
    try {
      [fresh1, fresh2] = await readReserves(api, pool.asset1, pool.asset2);
    } catch (cause) {
      setMessage(errorText(cause));
      return;
    }
    const min1 = withdrawalMin(fresh1, pool.lpSupply, raw, slippage);
    const min2 = withdrawalMin(fresh2, pool.lpSupply, raw, slippage);
    if (min1 === null || min2 === null) {
      setMessage("Reserves or LP supply are unavailable, so a minimum receive amount was not invented.");
      return;
    }
    await sign("Remove liquidity", (api) =>
      buildRemoveLiquidity(api, pool, raw, min1, min2, signer.address),
    );
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

function withdrawalMin(
  reserve: string | null,
  supply: string | null,
  burn: bigint,
  slippage: string,
): bigint | null {
  const reserveRaw = reserve?.replace(/,/g, "") ?? "";
  const supplyRawText = supply?.replace(/,/g, "") ?? "";
  if (!/^\d+$/.test(reserveRaw) || !/^\d+$/.test(supplyRawText)) return null;
  const supplyRaw = BigInt(supplyRawText);
  if (supplyRaw <= BigInt(0)) return null;
  const expected = (BigInt(reserveRaw) * burn) / supplyRaw;
  return applySlippage(expected, slippage);
}

function rawLpUnits(decimals: number | null): boolean {
  return decimals === null || decimals === 0;
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
