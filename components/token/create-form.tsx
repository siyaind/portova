"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useChain } from "@/components/chain/chain-provider";
import { useTxs } from "@/components/tx/tx-tracker";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { PageIntro, Panel } from "@/components/ui";
import {
  assetIdTaken,
  buildCreateMintTx,
  metadataDeposit,
  readAssetConstants,
  signAndSend,
  type AssetConstants,
  type CreateMintParams,
} from "@/lib/assets";
import { byteLength, errorText, formatUnits, parseDecimalToPlanck } from "@/lib/format";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";

const FIELD =
  "h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink placeholder:text-faint";

export function CreateTokenForm() {
  const chain = useChain();
  const wallet = useSubstrateWallet();
  const txs = useTxs();
  const router = useRouter();
  const signer = wallet.selected;
  const [constants, setConstants] = useState<AssetConstants | null>(null);
  const [constantsError, setConstantsError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState("8");
  const [supply, setSupply] = useState("");
  const [minBalance, setMinBalance] = useState("1");
  const [beneficiary, setBeneficiary] = useState("");
  const [assetId, setAssetId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [fee, setFee] = useState<string | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!idTouched && chain.assets) {
      const ids = chain.assets
        .map((asset) => Number(asset.id))
        .filter((id) => Number.isInteger(id) && id >= 0);
      const next = ids.length === 0 ? 1 : Math.max(...ids) + 1;
      setAssetId(String(next));
    }
  }, [chain.assets, idTouched]);

  useEffect(() => {
    if (signer && beneficiary === "") setBeneficiary(signer.address);
  }, [signer, beneficiary]);

  useEffect(() => {
    const api = chain.getApi();
    if (chain.status !== "live" || !api) return;
    const next = readAssetConstants(api);
    if (!next) {
      setConstantsError("Asset deposit constants are unavailable, so creation stays off.");
      setConstants(null);
      return;
    }
    setConstants(next);
    setConstantsError(null);
  }, [chain, chain.status]);

  const decimalCount = Number(decimals);
  const decimalsValid = Number.isInteger(decimalCount) && decimalCount >= 0 && decimalCount <= 18;
  const supplyRaw = decimalsValid ? parseDecimalToPlanck(supply, decimalCount) : null;
  const minRaw = decimalsValid ? parseDecimalToPlanck(minBalance, decimalCount) : null;
  const idNumber = Number(assetId);
  const idValid = /^\d+$/.test(assetId.trim()) && Number.isSafeInteger(idNumber) && idNumber >= 0 && idNumber <= 4_294_967_295;
  const nameBytes = byteLength(name);
  const symbolBytes = byteLength(symbol);
  const limit = constants?.stringLimit ?? 50;
  const nameValid = nameBytes > 0 && nameBytes <= limit;
  const symbolValid = symbolBytes > 0 && symbolBytes <= limit;
  const beneficiaryValue = beneficiary.trim() || signer?.address || "";
  const params: CreateMintParams | null =
    signer &&
    constants &&
    idValid &&
    nameValid &&
    symbolValid &&
    decimalsValid &&
    supplyRaw !== null &&
    supplyRaw > BigInt(0) &&
    minRaw !== null &&
    minRaw > BigInt(0) &&
    supplyRaw >= minRaw
      ? {
          id: idNumber,
          admin: signer.address,
          minBalance: minRaw,
          name: name.trim(),
          symbol: symbol.trim(),
          decimals: decimalCount,
          beneficiary: beneficiaryValue,
          supply: supplyRaw,
        }
      : null;

  const paramKey = params
    ? `${params.id}|${params.name}|${params.symbol}|${params.decimals}|${params.minBalance}|${params.supply}|${params.beneficiary}|${params.admin}`
    : "";

  useEffect(() => {
    const api = chain.getApi();
    if (!params || !api || !signer) {
      setFee(null);
      setFeeError(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const tx = buildCreateMintTx(api, params);
      tx.paymentInfo(signer.address)
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
  }, [paramKey, chain, signer]);

  const reserved = useMemo(() => {
    if (!constants || !nameValid || !symbolValid) return null;
    return {
      asset: constants.assetDeposit,
      metadata: metadataDeposit(constants, name.trim(), symbol.trim()).toString(),
      account: constants.assetAccountDeposit,
    };
  }, [constants, name, symbol, nameValid, symbolValid]);

  const problems = problemsFor({
    chainLive: chain.status === "live",
    constants,
    idValid,
    idTaken: Boolean(chain.assets?.some((asset) => asset.id === assetId.trim())),
    nameValid,
    symbolValid,
    nameBytes,
    symbolBytes,
    limit,
    decimalsValid,
    supplyRaw,
    minRaw,
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

    const id = crypto.randomUUID();
    setSubmitting(true);
    txs.push({
      id,
      label: `Create asset ${params.id}`,
      status: "signing",
    });
    try {
      if (await assetIdTaken(api, params.id)) {
        const message = `Asset id ${params.id} is already on chain. Choose another id.`;
        setFormError(message);
        txs.patch(id, { status: "failed", error: message });
        return;
      }
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const injected = await web3FromSource(signer.source);
      if (!injected.signer) {
        throw new Error("This wallet did not provide a signer.");
      }
      const tx = buildCreateMintTx(api, params);
      const result = await signAndSend(api, tx, signer.address, injected.signer, (update) => {
        txs.patch(id, update);
      });
      if (result.status === "failed") {
        setFormError(result.error ?? "The transaction failed.");
        return;
      }
      await chain.refreshAssets();
      if (result.status === "finalized") router.push(`/token/${params.id}`);
    } catch (cause) {
      const message = errorText(cause);
      setFormError(message);
      txs.patch(id, { status: "failed", error: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Token launchpad"
        title="Create and mint an asset"
        body="One signature sends assets.create, assets.setMetadata, and assets.mint as a single batch. If any call fails, none of them are kept. The signing account becomes owner, issuer, admin, and freezer, so it can mint more until that role changes."
      />
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"
      >
        <Panel className="space-y-4 p-4">
          <Field label="Name" hint={`${nameBytes}/${limit} bytes`}>
            <input className={FIELD} value={name} maxLength={limit} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Symbol" hint={`${symbolBytes}/${limit} bytes`}>
            <input className={FIELD} value={symbol} maxLength={limit} onChange={(event) => setSymbol(event.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Decimals" hint="0 to 18">
              <input className={FIELD} inputMode="numeric" value={decimals} onChange={(event) => setDecimals(event.target.value)} required />
            </Field>
            <Field label="Asset id" hint="Unused u32">
              <input
                className={FIELD}
                inputMode="numeric"
                value={assetId}
                onChange={(event) => {
                  setIdTouched(true);
                  setAssetId(event.target.value);
                }}
                required
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Initial supply" hint="Whole tokens, then decimals">
              <input className={FIELD} inputMode="decimal" value={supply} onChange={(event) => setSupply(event.target.value)} placeholder="1000" required />
            </Field>
            <Field label="Minimum balance" hint="Smallest account balance, in tokens">
              <input className={FIELD} inputMode="decimal" value={minBalance} onChange={(event) => setMinBalance(event.target.value)} required />
            </Field>
          </div>
          <Field label="Mint to" hint="Defaults to the signing account">
            <input className={`${FIELD} font-mono text-xs`} value={beneficiary} onChange={(event) => setBeneficiary(event.target.value)} spellCheck={false} />
          </Field>
          <Field label="Admin" hint="Locked to the signer so the mint in this batch is authorized">
            <input className={`${FIELD} font-mono text-xs`} value={signer?.address ?? ""} disabled />
          </Field>
          {attempted && problems.length > 0 ? (
            <ul className="space-y-1 text-sm text-warn">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
          {chain.status === "unavailable" ? (
            <p className="text-sm leading-6 text-warn">
              {chain.error ?? "The testnet connection is unavailable."}
            </p>
          ) : null}
          {wallet.error ? <p className="text-sm leading-6 text-warn">{wallet.error}</p> : null}
          {formError ? <p className="text-sm leading-6 text-warn">{formError}</p> : null}
          <button
            type="submit"
            disabled={submitting || chain.status !== "live"}
            className="w-full rounded-lg bg-violet px-3 py-2.5 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Waiting for the wallet…"
              : signer
                ? "Create and mint"
                : "Connect Substrate wallet"}
          </button>
          {!signer ? (
            <p className="text-xs leading-5 text-faint">
              Connecting only reads accounts. The create batch is a separate signature.
            </p>
          ) : null}
        </Panel>
        <Panel className="space-y-4 p-4">
          <h2 className="text-sm font-medium">What will be signed</h2>
          <ol className="list-decimal space-y-2 pl-4 text-sm text-muted">
            <li>assets.create</li>
            <li>assets.setMetadata</li>
            <li>assets.mint</li>
          </ol>
          <p className="text-sm leading-6 text-muted">
            Wrapped in utility.batchAll. Vesting is not included. Sale proceeds are not moved.
          </p>
          <dl className="space-y-3 text-sm">
            <Preview
              term={`Class deposit reserved (${NATIVE_SYMBOL})`}
              value={reserved ? formatUnits(reserved.asset, NATIVE_DECIMALS) : "Unavailable"}
            />
            <Preview
              term={`Metadata deposit reserved (${NATIVE_SYMBOL})`}
              value={reserved ? formatUnits(reserved.metadata, NATIVE_DECIMALS) : "Unavailable"}
            />
            <Preview
              term={`First account deposit reserved (${NATIVE_SYMBOL})`}
              value={reserved ? formatUnits(reserved.account, NATIVE_DECIMALS) : "Unavailable"}
            />
            <Preview
              term={`Estimated fee (${NATIVE_SYMBOL})`}
              value={
                fee
                  ? formatUnits(fee, NATIVE_DECIMALS, 6)
                  : signer
                    ? feeError
                      ? "Unavailable"
                      : "Estimating…"
                    : "After wallet connect"
              }
            />
          </dl>
          {feeError ? <p className="text-xs leading-5 text-warn">{feeError}</p> : null}
          {constantsError ? <p className="text-xs leading-5 text-warn">{constantsError}</p> : null}
          <p className="text-xs leading-5 text-faint">
            Deposits come from the Assets pallet constants and are reserved, not a price. The fee is paymentInfo from the node. Neither number is a balance.
          </p>
        </Panel>
      </form>
    </div>
  );
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
  constants: AssetConstants | null;
  idValid: boolean;
  idTaken: boolean;
  nameValid: boolean;
  symbolValid: boolean;
  nameBytes: number;
  symbolBytes: number;
  limit: number;
  decimalsValid: boolean;
  supplyRaw: bigint | null;
  minRaw: bigint | null;
}): string[] {
  const problems: string[] = [];
  if (!input.chainLive) problems.push("The testnet connection is not ready.");
  if (!input.constants) problems.push("Deposit constants have not loaded.");
  if (!input.idValid) problems.push("Asset id must be an integer from 0 to 4294967295.");
  if (input.idTaken) problems.push("That asset id already has metadata. Pick another id.");
  if (!input.nameValid) problems.push(`Name must be 1 to ${input.limit} bytes. This one is ${input.nameBytes}.`);
  if (!input.symbolValid) problems.push(`Symbol must be 1 to ${input.limit} bytes. This one is ${input.symbolBytes}.`);
  if (!input.decimalsValid) problems.push("Decimals must be a whole number from 0 to 18.");
  if (input.supplyRaw === null) problems.push("Supply must be a positive decimal that fits the chosen decimals and u128.");
  else if (input.supplyRaw === BigInt(0)) problems.push("Supply must be greater than zero.");
  if (input.minRaw === null) problems.push("Minimum balance must be a decimal that fits the chosen decimals and u128.");
  else if (input.minRaw === BigInt(0)) problems.push("Minimum balance must be greater than zero.");
  if (
    input.supplyRaw !== null &&
    input.minRaw !== null &&
    input.supplyRaw > BigInt(0) &&
    input.minRaw > BigInt(0) &&
    input.supplyRaw < input.minRaw
  ) {
    problems.push("Initial supply must be at least the minimum balance.");
  }
  return problems;
}
