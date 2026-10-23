import type { ApiPromise } from "@polkadot/api";
import { readItemProfile } from "@/lib/nfts";

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
  const allowed = new Set(collectionIds.filter((id) => /^\d+$/.test(id)).slice(0, 20));
  try {
    const entries = (await api.query.nfts.itemPriceOf.entries()) as Array<
      [{ args: unknown[] }, PriceCodec]
    >;
    return listingsFromPrices(api, entries, allowed);
  } catch {
    return scanListingsByProbe(api, [...allowed]);
  }
}

async function listingsFromPrices(
  api: ApiPromise,
  entries: Array<[{ args: unknown[] }, PriceCodec]>,
  allowed: Set<string>,
): Promise<Listing[]> {
  const listings: Listing[] = [];
  for (const [key, value] of entries) {
    const collectionId = argText(key.args[0]);
    const itemId = argText(key.args[1]);
    if (!allowed.has(collectionId) || !inScanRange(itemId)) continue;
    const sale = saleFromPrice(value);
    if (!sale.listed || !sale.price) continue;
    listings.push(await listingRow(api, collectionId, itemId, sale));
  }
  return listings;
}

async function scanListingsByProbe(api: ApiPromise, collectionIds: string[]): Promise<Listing[]> {
  const listings: Listing[] = [];
  for (const collectionId of collectionIds) {
    for (let itemId = 0; itemId < 24; itemId += 1) {
      try {
        const sale = await readItemSale(api, collectionId, String(itemId));
        if (!sale.listed || !sale.price) continue;
        listings.push(await listingRow(api, collectionId, String(itemId), sale));
      } catch {
        continue;
      }
    }
  }
  return listings;
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

function inScanRange(itemId: string): boolean {
  return /^\d+$/.test(itemId) && Number(itemId) >= 0 && Number(itemId) <= 23;
}

function argText(value: unknown): string {
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
