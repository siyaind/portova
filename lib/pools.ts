import type { ApiPromise } from "@polkadot/api";
import { NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import { lpTokenFromPoolValue, parsePoolKey } from "@/lib/pool-key";
import { readPositionAtFinalizedBlock, type PoolPosition } from "@/lib/pool-position";
import { balanceDigits, reservePaysSwap } from "@/lib/reserve-quote";
import { storagePage, type StoragePageQuery } from "@/lib/storage-page";
import { mapBounded } from "@/lib/async-map";

export { balanceDigits, reservePaysSwap };
export type { PoolPosition };

export type AssetRef = { kind: "native" } | { kind: "asset"; id: string };

export type PoolView = {
  asset1: AssetRef;
  asset2: AssetRef;
  lpToken: string;
  reserve1: string | null;
  reserve2: string | null;
  lpDecimals: number | null;
  lpSupply: string | null;
};

export type PoolConstants = {
  lpFee: string;
  poolSetupFee: string;
  poolSetupFeeAsset: string;
  withdrawalFee: string;
  mintMinLiquidity: string;
  existentialDeposit: string | null;
};

export function encodeAsset(asset: AssetRef): { Native: null } | { WithId: number } {
  if (asset.kind === "native") return { Native: null };
  return { WithId: Number(asset.id) };
}

export function sameAsset(left: AssetRef, right: AssetRef): boolean {
  if (left.kind === "native" || right.kind === "native") return left.kind === right.kind;
  return left.id === right.id;
}

export function assetKey(asset: AssetRef): string {
  return asset.kind === "native" ? "native" : `asset:${asset.id}`;
}

export function parseAsset(codec: { toHuman?: () => unknown }): AssetRef | null {
  const human = codec.toHuman?.();
  if (human === "Native") return { kind: "native" };
  if (human && typeof human === "object" && "WithId" in human) {
    const id = String((human as { WithId: unknown }).WithId).replace(/,/g, "");
    if (/^\d+$/.test(id)) return { kind: "asset", id };
  }
  return null;
}

function digits(value: { toString?: () => string } | undefined): string | null {
  const text = value?.toString?.()?.replace(/,/g, "");
  return text && /^\d+$/.test(text) ? text : null;
}

export function readPoolConstants(api: ApiPromise): PoolConstants | null {
  const consts = api.consts.assetConversion as unknown as {
    lpFee?: { toHuman?: () => unknown };
    poolSetupFee?: { toString?: () => string };
    poolSetupFeeAsset?: { toHuman?: () => unknown };
    liquidityWithdrawalFee?: { toHuman?: () => unknown };
    mintMinLiquidity?: { toString?: () => string };
  };
  const balances = api.consts.balances as unknown as {
    existentialDeposit?: { toString?: () => string };
  };
  const poolSetupFee = digits(consts.poolSetupFee);
  const mintMinLiquidity = digits(consts.mintMinLiquidity);
  if (!poolSetupFee || !mintMinLiquidity) return null;
  return {
    lpFee: String(consts.lpFee?.toHuman?.() ?? "Unavailable"),
    poolSetupFee,
    poolSetupFeeAsset: String(consts.poolSetupFeeAsset?.toHuman?.() ?? "Native"),
    withdrawalFee: String(consts.liquidityWithdrawalFee?.toHuman?.() ?? "Unavailable"),
    mintMinLiquidity,
    existentialDeposit: digits(balances.existentialDeposit),
  };
}

export async function readPoolPosition(
  api: ApiPromise,
  asset1: AssetRef,
  asset2: AssetRef,
  lpToken: string,
): Promise<PoolPosition> {
  return readPositionAtFinalizedBlock({
    finalizedHash: async () => {
      const hash = (await api.rpc.chain.getFinalizedHead()).toHex();
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("The finalized block hash could not be read.");
      return hash;
    },
    readAt: async (blockHash) => {
      const at = (await api.at(blockHash)) as ApiPromise;
      const [reserves, lpSupply] = await Promise.all([
        readReserves(at, asset1, asset2),
        readLpSupply(at, lpToken),
      ]);
      return { reserve1: reserves[0], reserve2: reserves[1], lpSupply };
    },
  });
}

export async function readReserves(
  api: ApiPromise,
  asset1: AssetRef,
  asset2: AssetRef,
): Promise<[string | null, string | null]> {
  const result = (await api.call.assetConversionApi.getReserves(
    encodeAsset(asset1),
    encodeAsset(asset2),
  )) as unknown as {
    isNone?: boolean;
    unwrap?: () => [{ toString(): string }, { toString(): string }];
  };
  if (result.isNone || !result.unwrap) return [null, null];
  const pair = result.unwrap();
  return [balanceDigits(pair[0].toString()), balanceDigits(pair[1].toString())];
}

export async function readPools(api: ApiPromise): Promise<PoolView[]> {
  const rows: PoolView[] = []; let cursor: string | null = null, blockHash: string | undefined;
  do { const page = await readPoolPage(api, cursor, blockHash); rows.push(...page.rows); cursor = page.nextCursor; blockHash = page.blockHash; } while (cursor);
  return rows;
}

export async function readPoolPage(api: ApiPromise, cursor?: string | null, snapshotHash?: string) {
  const blockHash = snapshotHash ?? (await api.rpc.chain.getFinalizedHead()).toHex();
  const at = await api.at(blockHash) as unknown as ApiPromise;
  const page = await storagePage(at.query.assetConversion.pools as unknown as StoragePageQuery<Parameters<typeof lpTokenFromPoolValue>[0]>, cursor, 16);
  const pools = await mapBounded(page.entries, 4, async ([key, value]): Promise<PoolView | null> => {
    let pair: ReturnType<typeof parsePoolKey>;
    try {
      pair = parsePoolKey(key as { args: unknown[] });
    } catch {
      throw new Error("A stored pool key could not be decoded. Discovery is incomplete.");
    }
    if (!pair) throw new Error("A stored pool pair could not be decoded.");
    const [asset1, asset2] = pair;
    const lpToken = lpTokenFromPoolValue(value);
    if (!lpToken) throw new Error("A stored LP token could not be decoded.");
    let reserve1: string | null = null;
    let reserve2: string | null = null;
    try {
      [reserve1, reserve2] = await readReserves(at, asset1, asset2);
    } catch {
      reserve1 = null;
      reserve2 = null;
    }
    let lpDecimals: number | null = null;
    try {
      const metadata = (await at.query.poolAssets.metadata(lpToken)) as unknown as {
        decimals?: { toNumber?: () => number };
        isNone?: boolean;
        unwrap?: () => { decimals?: { toNumber?: () => number } };
      };
      const record = metadata.isNone ? null : metadata.unwrap ? metadata.unwrap() : metadata;
      const decimals = record?.decimals?.toNumber?.();
      lpDecimals = typeof decimals === "number" ? decimals : null;
    } catch {
      lpDecimals = null;
    }
    const lpSupply = await readLpSupply(at, lpToken);
    return { asset1, asset2, lpToken, reserve1, reserve2, lpDecimals, lpSupply };
  });
  return { rows: pools.filter((row): row is PoolView => row !== null), blockHash, nextCursor: page.nextCursor, complete: page.complete };
}

export async function quoteExactIn(
  api: ApiPromise,
  assetIn: AssetRef,
  assetOut: AssetRef,
  amountIn: bigint,
  blockHash?: string,
): Promise<string | null> {
  const source = blockHash ? ((await api.at(blockHash)) as ApiPromise) : api;
  const quoted = (await source.call.assetConversionApi.quotePriceExactTokensForTokens(
    encodeAsset(assetIn),
    encodeAsset(assetOut),
    amountIn,
    true,
  )) as unknown as { isNone?: boolean; unwrap?: () => { toString(): string } };
  if (quoted.isNone || !quoted.unwrap) return null;
  const amount = quoted.unwrap().toString().replace(/,/g, "");
  return /^\d+$/.test(amount) ? amount : null;
}

export async function quoteForSwap(
  api: ApiPromise,
  assetIn: AssetRef,
  assetOut: AssetRef,
  amountIn: bigint,
): Promise<{ amount: string; blockHash: string | null } | null> {
  let blockHash: string | null = null;
  try {
    const hash = (await api.rpc.chain.getFinalizedHead()).toHex();
    if (/^0x[0-9a-fA-F]{64}$/.test(hash)) blockHash = hash;
  } catch {
    blockHash = null;
  }
  const pinned = usableQuote(blockHash ? await quoteExactIn(api, assetIn, assetOut, amountIn, blockHash) : null);
  if (pinned) return { amount: pinned, blockHash };
  const latest = usableQuote(await quoteExactIn(api, assetIn, assetOut, amountIn));
  return latest ? { amount: latest, blockHash: null } : null;
}

function usableQuote(value: string | null): string | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  return value;
}

export async function readLpSupply(api: ApiPromise, lpToken: string): Promise<string | null> {
  try {
    const assetInfo = (await api.query.poolAssets.asset(lpToken)) as unknown as {
      isNone?: boolean;
      unwrap?: () => { supply?: { toString(): string } };
    };
    if (assetInfo.isNone || !assetInfo.unwrap) return null;
    const supply = assetInfo.unwrap().supply?.toString().replace(/,/g, "") ?? "";
    return /^\d+$/.test(supply) ? supply : null;
  } catch {
    return null;
  }
}

export async function missingLpAccountDeposit(
  api: ApiPromise,
  lpToken: string,
  address: string,
  blockHash?: string,
): Promise<bigint | null> {
  const consts = api.consts.poolAssets as unknown as {
    assetAccountDeposit?: { toString?: () => string };
  };
  const depositText = consts.assetAccountDeposit?.toString?.()?.replace(/,/g, "") ?? "";
  if (!/^\d+$/.test(depositText)) return null;
  const source = blockHash ? ((await api.at(blockHash)) as ApiPromise) : api;
  const stored = (await source.query.poolAssets.account(lpToken, address)) as unknown as { isNone?: boolean };
  if (typeof stored.isNone !== "boolean") return null;
  return stored.isNone ? BigInt(depositText) : BigInt(0);
}

export async function readLpBalance(
  api: ApiPromise,
  lpToken: string,
  address: string,
): Promise<string | null> {
  const stored = (await api.query.poolAssets.account(lpToken, address)) as unknown as {
    isNone?: boolean;
    unwrap?: () => { balance?: { toString(): string } };
    balance?: { toString(): string };
  };
  if (stored.isNone === true) return "0";
  const record = stored.unwrap ? stored.unwrap() : stored;
  const balance = record.balance?.toString().replace(/,/g, "") ?? "";
  return /^\d+$/.test(balance) ? balance : null;
}

export function buildCreatePool(api: ApiPromise, asset1: AssetRef, asset2: AssetRef) {
  return api.tx.assetConversion.createPool(encodeAsset(asset1), encodeAsset(asset2));
}

export function buildAddLiquidity(
  api: ApiPromise,
  pool: PoolView,
  amount1: bigint,
  amount2: bigint,
  amount1Min: bigint,
  amount2Min: bigint,
  mintTo: string,
  prepareLpAccount = false,
) {
  const add = api.tx.assetConversion.addLiquidity(
    encodeAsset(pool.asset1),
    encodeAsset(pool.asset2),
    amount1,
    amount2,
    amount1Min,
    amount2Min,
    mintTo,
  );
  // Deposit-backed LP accounts avoid the runtime consumer-reference limit.
  if (!prepareLpAccount) return add;
  if (!api.tx.poolAssets?.touch) throw Error("LP account setup is unavailable on this runtime.");
  return api.tx.utility.batchAll([api.tx.poolAssets.touch(pool.lpToken), add]);
}

export function buildRemoveLiquidity(
  api: ApiPromise,
  pool: PoolView,
  lpTokenBurn: bigint,
  amount1Min: bigint,
  amount2Min: bigint,
  withdrawTo: string,
) {
  return api.tx.assetConversion.removeLiquidity(
    encodeAsset(pool.asset1),
    encodeAsset(pool.asset2),
    lpTokenBurn,
    amount1Min,
    amount2Min,
    withdrawTo,
  );
}

export function buildSwapExactIn(
  api: ApiPromise,
  assetIn: AssetRef,
  assetOut: AssetRef,
  amountIn: bigint,
  amountOutMin: bigint,
  sendTo: string,
) {
  return api.tx.assetConversion.swapExactTokensForTokens(
    [encodeAsset(assetIn), encodeAsset(assetOut)],
    amountIn,
    amountOutMin,
    sendTo,
    true,
  );
}

export function poolLabel(
  pool: PoolView,
  symbols: Map<string, string>,
): string {
  return `${assetLabel(pool.asset1, symbols)} / ${assetLabel(pool.asset2, symbols)}`;
}

export function assetLabel(asset: AssetRef, symbols: Map<string, string>): string {
  if (asset.kind === "native") return NATIVE_SYMBOL;
  return symbols.get(asset.id) ?? `Asset ${asset.id}`;
}

export function assetDecimals(asset: AssetRef, decimals: Map<string, number>): number | null {
  if (asset.kind === "native") return NATIVE_DECIMALS;
  return decimals.get(asset.id) ?? null;
}

export function applySlippage(amount: bigint, percent: string): bigint | null {
  const bps = percent === "0.1" ? 10n : percent === "0.5" ? 50n : percent === "1" ? 100n : null;
  if (bps === null || amount <= BigInt(0)) return null;
  return (amount * (10000n - bps)) / 10000n;
}

export function reservesUsable(pool: PoolView): boolean {
  return usable(pool.reserve1) && usable(pool.reserve2);
}

function usable(value: string | null): boolean {
  return value !== null && /^\d+$/.test(value) && BigInt(value) > BigInt(0);
}
