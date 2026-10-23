import type { ApiPromise } from "@polkadot/api";
import { keptAliveSpendable } from "@/lib/balance";
import { errorText } from "@/lib/format";

export type AssetRow = {
  id: string;
  name: string;
  symbol: string;
  decimals: number | null;
  frozen: boolean | null;
};

export type HoldingRow = {
  id: string;
  symbol: string;
  decimals: number | null;
  balance: string;
};

export type AccountSnapshot = {
  free: string | null;
  spendable: string | null;
  holdings: HoldingRow[];
  error: string | null;
};

function digits(value: { toString(): string } | undefined): string | null {
  const text = value?.toString().replace(/,/g, "") ?? "";
  return /^\d+$/.test(text) ? text : null;
}

function largestFrozen(data: {
  frozen?: { toString(): string };
  miscFrozen?: { toString(): string };
  feeFrozen?: { toString(): string };
}): bigint | null {
  const values = [data.frozen, data.miscFrozen, data.feeFrozen]
    .map((item) => digits(item))
    .filter((item): item is string => Boolean(item))
    .map((item) => BigInt(item));
  if (values.length === 0) return null;
  return values.reduce((max, value) => (value > max ? value : max), BigInt(0));
}

function textOf(value: { toUtf8?: () => string } | undefined): string {
  try {
    const text = value?.toUtf8?.() ?? "";
    return text.trim();
  } catch {
    return "";
  }
}

export type AssetProfile = {
  id: string;
  found: boolean;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  frozen: boolean | null;
  owner: string | null;
  issuer: string | null;
  admin: string | null;
  freezer: string | null;
  supply: string | null;
  minBalance: string | null;
  deposit: string | null;
  accounts: string | null;
  status: string | null;
  isSufficient: boolean | null;
};

export async function readAssetProfile(api: ApiPromise, id: string): Promise<AssetProfile> {
  const empty: AssetProfile = {
    id,
    found: false,
    name: null,
    symbol: null,
    decimals: null,
    frozen: null,
    owner: null,
    issuer: null,
    admin: null,
    freezer: null,
    supply: null,
    minBalance: null,
    deposit: null,
    accounts: null,
    status: null,
    isSufficient: null,
  };
  const [asset, meta] = await Promise.all([
    api.query.assets.asset(id),
    api.query.assets.metadata(id),
  ]);
  const optional = asset as unknown as {
    isNone?: boolean;
    unwrap?: () => {
      owner: { toString(): string };
      issuer: { toString(): string };
      admin: { toString(): string };
      freezer: { toString(): string };
      supply: { toString(): string };
      minBalance: { toString(): string };
      deposit: { toString(): string };
      accounts: { toString(): string };
      status: { toString(): string };
      isSufficient?: { isTrue?: boolean };
    };
  };
  if (optional.isNone || !optional.unwrap) return empty;
  const details = optional.unwrap();
  const record = meta as unknown as {
    name?: { toUtf8?: () => string };
    symbol?: { toUtf8?: () => string };
    decimals?: { toNumber?: () => number };
    isFrozen?: { isTrue?: boolean };
  };
  const decimals = record.decimals?.toNumber?.();
  return {
    id,
    found: true,
    name: textOf(record.name) || "Unnamed",
    symbol: textOf(record.symbol) || "—",
    decimals: typeof decimals === "number" && Number.isFinite(decimals) ? decimals : null,
    frozen: record.isFrozen?.isTrue ?? null,
    owner: details.owner.toString(),
    issuer: details.issuer.toString(),
    admin: details.admin.toString(),
    freezer: details.freezer.toString(),
    supply: details.supply.toString(),
    minBalance: details.minBalance.toString(),
    deposit: details.deposit.toString(),
    accounts: details.accounts.toString(),
    status: details.status.toString(),
    isSufficient: details.isSufficient?.isTrue ?? null,
  };
}

export async function readAssets(api: ApiPromise): Promise<AssetRow[]> {
  const entries = await api.query.assets.metadata.entries();
  const rows: AssetRow[] = [];
  for (const [key, meta] of entries) {
    const id = key.args[0]?.toString() ?? "";
    const record = meta as unknown as {
      name?: { toUtf8?: () => string };
      symbol?: { toUtf8?: () => string };
      decimals?: { toNumber?: () => number };
      isFrozen?: { isTrue?: boolean };
    };
    const decimals = record.decimals?.toNumber?.();
    rows.push({
      id,
      name: textOf(record.name) || "Unnamed",
      symbol: textOf(record.symbol) || "—",
      decimals: typeof decimals === "number" && Number.isFinite(decimals) ? decimals : null,
      frozen: record.isFrozen?.isTrue ?? null,
    });
  }
  return rows.sort((a, b) => Number(a.id) - Number(b.id));
}

export async function readAssetMinBalance(api: ApiPromise, id: string): Promise<bigint | null> {
  const stored = await api.query.assets.asset(id);
  const optional = stored as unknown as {
    isNone?: boolean;
    unwrap?: () => { minBalance?: { toString(): string } };
  };
  if (optional.isNone || !optional.unwrap) return null;
  const text = optional.unwrap().minBalance?.toString().replace(/,/g, "") ?? "";
  return /^\d+$/.test(text) ? BigInt(text) : null;
}

export async function countEntries(
  api: ApiPromise,
  pallet: string,
  item: string,
): Promise<number | null> {
  const palletQuery = (
    api.query as unknown as Record<
      string,
      Record<string, { entries?: () => Promise<unknown[]> }> | undefined
    >
  )[pallet];
  const query = palletQuery?.[item];
  if (!query?.entries) return null;
  const entries = await query.entries();
  return entries.length;
}

export async function readAccount(
  api: ApiPromise,
  address: string,
  assets: AssetRow[],
): Promise<AccountSnapshot> {
  try {
  const account = (await api.query.system.account(address)) as unknown as {
    data: {
      free: { toString(): string };
      reserved?: { toString(): string };
      frozen?: { toString(): string };
      miscFrozen?: { toString(): string };
      feeFrozen?: { toString(): string };
    };
  };
  const free = digits(account.data.free);
  const reserved = digits(account.data.reserved);
  const frozen = largestFrozen(account.data);
  const existentialDeposit = digits(
    (api.consts.balances as { existentialDeposit?: { toString(): string } }).existentialDeposit,
  );
  const spendable = keptAliveSpendable({ free, reserved, frozen, existentialDeposit });
  const holdings: HoldingRow[] = [];

  for (const asset of assets) {
    const stored = await api.query.assets.account(asset.id, address);
    const optional = stored as unknown as {
      isNone?: boolean;
      unwrap?: () => { balance?: { toString: () => string } };
    };
    if (optional.isNone) continue;
    const balance = optional.unwrap?.().balance?.toString();
    if (!balance || balance === "0") continue;
    holdings.push({
      id: asset.id,
      symbol: asset.symbol,
      decimals: asset.decimals,
      balance,
    });
  }

  return { free, spendable, holdings, error: null };
  } catch (cause) {
    return { free: null, spendable: null, holdings: [], error: errorText(cause) };
  }
}
