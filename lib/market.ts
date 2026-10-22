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

export async function readItemSale(
  api: ApiPromise,
  collectionId: string,
  itemId: string,
): Promise<ItemSale> {
  const stored = (await api.query.nfts.itemPriceOf(collectionId, itemId)) as unknown as {
    isNone?: boolean;
    unwrap?: () => { toHuman?: () => unknown; toString?: () => string; amount?: { toString(): string } };
    toHuman?: () => unknown;
  };
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
  const listings: Listing[] = [];
  for (const collectionId of collectionIds.slice(0, 20)) {
    for (let itemId = 0; itemId < 24; itemId += 1) {
      let sale;
      try {
        sale = await readItemSale(api, collectionId, String(itemId));
      } catch {
        continue;
      }
      if (!sale.listed || !sale.price) continue;
      const item = await readItemProfile(api, collectionId, String(itemId)).catch(() => null);
      listings.push({
        collectionId,
        itemId: String(itemId),
        listed: true,
        price: sale.price,
        buyer: sale.buyer,
        owner: item?.owner ?? null,
        metadata: item?.metadata ?? null,
      });
    }
  }
  return listings;
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
