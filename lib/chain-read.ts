import type { ApiPromise } from "@polkadot/api";
import { keptAliveSpendable } from "./balance.ts";
import { errorText } from "./format.ts";
import { mapBounded } from "./async-map.ts";
import { storagePage, type StoragePageQuery } from "./storage-page.ts";

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
  loadedAt?: number;
  blockNumber?: string;
  blockHash?: string;
  holdingsComplete?: boolean;
  failedAssets?: string[];
  assetsChecked?: number;
  coverageNote?: string;
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

export async function readAssetPage(api: ApiPromise, cursor?: string | null, snapshotHash?: string) {
  const blockHash = snapshotHash ?? (await api.rpc.chain.getFinalizedHead()).toHex();
  const at = await api.at(blockHash);
  const page = await storagePage(at.query.assets.asset as unknown as StoragePageQuery<unknown>, cursor, 32);
  const rows = await mapBounded(page.entries, 4, async ([key]) => {
    const id = key.args[0].toString();
    const meta = await at.query.assets.metadata(id);
    const record = meta as unknown as {
      name?: { toUtf8?: () => string };
      symbol?: { toUtf8?: () => string };
      decimals?: { toNumber?: () => number };
      isFrozen?: { isTrue?: boolean };
    };
    const decimals = record.decimals?.toNumber?.();
    return {
      id,
      name: textOf(record.name) || "Unnamed",
      symbol: textOf(record.symbol) || "—",
      decimals: typeof decimals === "number" && Number.isFinite(decimals) ? decimals : null,
      frozen: record.isFrozen?.isTrue ?? null,
    };
  });
  return { rows, blockHash, nextCursor: page.nextCursor, complete: page.complete };
}

export async function readAssets(api: ApiPromise): Promise<AssetRow[]> {
  const rows: AssetRow[] = []; let cursor: string | null = null, blockHash: string | undefined;
  do { const page = await readAssetPage(api, cursor, blockHash); rows.push(...page.rows); cursor = page.nextCursor; blockHash = page.blockHash; } while (cursor);
  return rows.sort((a, b) => Number(a.id) - Number(b.id));
}

export async function readAssetMinBalance(api: ApiPromise, id: string, blockHash?: string): Promise<bigint | null> {
  const source = blockHash ? ((await api.at(blockHash)) as ApiPromise) : api;
  const stored = await source.query.assets.asset(id);
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
  const at = await api.at(await api.rpc.chain.getFinalizedHead());
  const query = (at.query as unknown as Record<string, Record<string, StoragePageQuery<unknown>> | undefined>)[pallet]?.[item];
  if (!query) return null;
  let count = 0, cursor: string | null = null;
  do { const page: { entries: unknown[]; nextCursor: string | null } = await storagePage(query, cursor); count += page.entries.length; cursor = page.nextCursor; } while (cursor);
  return count;
}

export async function readAccount(
  api: ApiPromise,
  address: string,
  assets: AssetRow[],
  onNative?: (snapshot: AccountSnapshot) => void,
  discoveryComplete = true,
): Promise<AccountSnapshot> {
  let native: AccountSnapshot;
  let at: ApiPromise;
  try {
    const blockHash = (await api.rpc.chain.getFinalizedHead()).toHex();
    const [source, header] = await Promise.all([api.at(blockHash), api.rpc.chain.getHeader(blockHash)]);
    at = source as unknown as ApiPromise;
    const account = (await at.query.system.account(address)) as unknown as {
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
      (at.consts.balances as { existentialDeposit?: { toString(): string } }).existentialDeposit,
    );
    native = {
      free,
      spendable: keptAliveSpendable({ free, reserved, frozen, existentialDeposit }),
      holdings: [],
      error: null,
      blockHash, blockNumber: header.number.toString(), loadedAt: Date.now(), holdingsComplete: false,
    };
  } catch (cause) {
    return { free: null, spendable: null, holdings: [], error: errorText(cause) };
  }
  onNative?.(native);
  const failedAssets: string[] = [];
  const holdings = (await mapBounded(assets, 6, async asset => {
    try { return await readHolding(at, asset, address); }
    catch { failedAssets.push(asset.id); return null; }
  })).filter((row): row is HoldingRow => row !== null);
  return { ...native, loadedAt: Date.now(), holdings, failedAssets, assetsChecked: assets.length,
    holdingsComplete: discoveryComplete && failedAssets.length === 0,
    coverageNote: !discoveryComplete ? "Asset discovery is incomplete. Some holdings may be missing." : failedAssets.length ? `${failedAssets.length} asset balance or metadata reads failed. Retry to complete this snapshot.` : undefined };
}

async function readHolding(api: ApiPromise, asset: AssetRow, address: string): Promise<HoldingRow | null> {
    const stored = await api.query.assets.account(asset.id, address);
    const optional = stored as unknown as {
      isNone?: boolean;
      unwrap?: () => { balance?: { toString: () => string } };
    };
    if (optional.isNone) return null;
    const balance = optional.unwrap?.().balance?.toString().replace(/,/g, "") ?? "";
    if (!/^\d+$/.test(balance)) throw new Error("Invalid asset balance.");
    if (balance === "0") return null;
    const meta = await api.query.assets.metadata(asset.id) as unknown as { symbol?: { toUtf8(): string }; decimals?: { toNumber(): number } };
    const decimals = meta.decimals?.toNumber();
    if (!Number.isInteger(decimals) || decimals === undefined) throw new Error("Asset precision is unavailable.");
    return { id: asset.id, symbol: textOf(meta.symbol) || "—", decimals, balance };
}
