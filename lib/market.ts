import type { ApiPromise } from "@polkadot/api";
import { readItemProfile } from "./nfts.ts";
import { storagePage, type StoragePageQuery } from "./storage-page.ts";

export const NFT_FEATURE_TRADING = 1n;

export type ItemSale = {
  listed: boolean;
  price: string | null;
  buyer: string | null;
};

export type Listing = ItemSale & {
  collectionId: string;
  itemId: string;
  owner: string | null;
  metadata: string | null;
};

export function readTradingEnabled(api: ApiPromise): boolean | null {
  const features = (api.consts.nfts as { features?: { toString?: () => string } }).features;
  const raw = features?.toString?.().replace(/,/g, "");
  if (!raw || !/^\d+$/.test(raw)) return null;
  return (BigInt(raw) & NFT_FEATURE_TRADING) === NFT_FEATURE_TRADING;
}

type PriceCodec = {
  isNone?: boolean;
  unwrap?: () => { toHuman?: () => unknown };
  toHuman?: () => unknown;
};

export async function readItemSale(
  api: ApiPromise,
  collectionId: string,
  itemId: string,
): Promise<ItemSale> {
  const stored = (await api.query.nfts.itemPriceOf(collectionId, itemId)) as unknown as PriceCodec;
  return saleFromPrice(stored);
}

function saleFromPrice(stored: PriceCodec): ItemSale {
  if (stored.isNone) return { listed: false, price: null, buyer: null };
  const human = stored.unwrap?.().toHuman?.() ?? stored.toHuman?.();
  if (typeof human === "string" || typeof human === "number") {
    const price = String(human).replace(/,/g, "");
    return { listed: /^\d+$/.test(price), price: /^\d+$/.test(price) ? price : null, buyer: null };
  }
  if (human && typeof human === "object") {
    const record = human as Record<string, unknown>;
    const raw = record.price ?? record.amount;
    const price = String(raw ?? "").replace(/,/g, "");
    const buyerRaw = record.whitelistedBuyer ?? record.whitelisted_buyer;
    const buyer =
      buyerRaw === null || buyerRaw === undefined || buyerRaw === "None" ? null : String(buyerRaw);
    return {
      listed: /^\d+$/.test(price),
      price: /^\d+$/.test(price) ? price : null,
      buyer,
    };
  }
  return { listed: false, price: null, buyer: null };
}

export async function scanListings(api: ApiPromise, collectionIds: string[]): Promise<Listing[]> {
  const allowed = new Set(collectionIds.filter(id => /^\d+$/.test(id)));
  const listings: Listing[] = [];
  let page = await readListingsPage(api);
  listings.push(...page.rows);
  while (page.nextCursor) { page = await readListingsPage(api, { cursor: page.nextCursor, blockHash: page.blockHash }); listings.push(...page.rows); }
  return listings.filter(row => allowed.has(row.collectionId));
}
export async function readListingsPage(api: ApiPromise, options: { cursor?: string | null; blockHash?: string; pageSize?: number } = {}) {
  const blockHash = options.blockHash ?? (await api.rpc.chain.getFinalizedHead()).toHex();
  const at = await api.at(blockHash);
  const page = await storagePage(at.query.nfts.itemPriceOf as unknown as StoragePageQuery<PriceCodec>, options.cursor, options.pageSize);
  const rows: Listing[] = [];
  for (const [key, value] of page.entries) {
    const collectionId = argText(key.args[0]), itemId = argText(key.args[1]), sale = saleFromPrice(value);
    if (/^\d+$/.test(collectionId) && /^\d+$/.test(itemId) && sale.listed && sale.price) rows.push(await listingRow(at as unknown as ApiPromise, collectionId, itemId, sale));
  }
  return { rows, blockHash, nextCursor: page.nextCursor, complete: page.complete, scanned: page.entries.length };
}

async function listingRow(api: ApiPromise, collectionId: string, itemId: string, sale: ItemSale): Promise<Listing> {
  const item = await readItemProfile(api, collectionId, itemId).catch(() => null);
  return {
    collectionId,
    itemId,
    listed: true,
    price: sale.price,
    buyer: sale.buyer,
    owner: item?.owner ?? null,
    metadata: item?.metadata ?? null,
  };
}

function argText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return value.toString();
  }
  return "";
}

export function buildSetPrice(
  api: ApiPromise,
  collectionId: number,
  itemId: number,
  price: bigint | null,
  buyer: string | null,
) {
  return api.tx.nfts.setPrice(collectionId, itemId, price, buyer);
}

export function buildBuyItem(api: ApiPromise, collectionId: number, itemId: number, bid: bigint) {
  return api.tx.nfts.buyItem(collectionId, itemId, bid);
}
