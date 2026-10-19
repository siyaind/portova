import type { ApiPromise } from "@polkadot/api";
import type { TxUpdate } from "@/lib/assets";

export const COLLECTION_SETTING = {
  TransferableItems: 1,
  UnlockedMetadata: 2,
  UnlockedAttributes: 4,
  UnlockedMaxSupply: 8,
  DepositRequired: 16,
} as const;

export const ITEM_SETTING = {
  Transferable: 1,
  UnlockedMetadata: 2,
  UnlockedAttributes: 4,
} as const;

export const COLLECTION_ROLE = {
  Issuer: 1,
  Freezer: 2,
  Admin: 4,
} as const;

export type NftConstants = {
  collectionDeposit: string;
  itemDeposit: string;
  metadataDepositBase: string;
  depositPerByte: string;
  stringLimit: number;
};

export type CollectionMintParams = {
  admin: string;
  collectionId: number;
  settings: number;
  itemSettings: number;
  maxSupply: number | null;
  publicMint: boolean;
  price: bigint | null;
  collectionMetadata: string;
  itemMetadata: string | null;
  itemId: number;
  mintTo: string;
};

export type CollectionSummary = {
  id: string;
  owner: string | null;
  items: string | null;
};

export type CollectionProfile = {
  id: string;
  found: boolean;
  owner: string | null;
  items: string | null;
  itemMetadatas: string | null;
  ownerDeposit: string | null;
  metadata: string | null;
  settings: number | null;
  maxSupply: string | null;
  mintType: string | null;
  price: string | null;
  roles: number | null;
};

export type ItemProfile = {
  found: boolean;
  owner: string | null;
  metadata: string | null;
};

function digits(value: { toString?: () => string } | undefined): string | null {
  const text = value?.toString?.();
  return text && /^\d+$/.test(text) ? text : null;
}

function textOf(value: { toUtf8?: () => string } | undefined): string | null {
  try {
    const text = value?.toUtf8?.().trim() ?? "";
    return text || null;
  } catch {
    return null;
  }
}

export function readNftConstants(api: ApiPromise): NftConstants | null {
  const consts = api.consts.nfts as unknown as {
    collectionDeposit?: { toString?: () => string };
    itemDeposit?: { toString?: () => string };
    metadataDepositBase?: { toString?: () => string };
    depositPerByte?: { toString?: () => string };
    stringLimit?: { toNumber?: () => number };
  };
  const collectionDeposit = digits(consts.collectionDeposit);
  const itemDeposit = digits(consts.itemDeposit);
  const metadataDepositBase = digits(consts.metadataDepositBase);
  const depositPerByte = digits(consts.depositPerByte);
  const stringLimit = consts.stringLimit?.toNumber?.();
  if (
    !collectionDeposit ||
    !itemDeposit ||
    !metadataDepositBase ||
    !depositPerByte ||
    typeof stringLimit !== "number"
  ) {
    return null;
  }
  return { collectionDeposit, itemDeposit, metadataDepositBase, depositPerByte, stringLimit };
}

export function byteDeposit(constants: NftConstants, data: string): bigint {
  return (
    BigInt(constants.metadataDepositBase) +
    BigInt(constants.depositPerByte) * BigInt(new TextEncoder().encode(data).length)
  );
}

export async function predictCollectionId(api: ApiPromise): Promise<number> {
  const next = (await api.query.nfts.nextCollectionId()) as unknown as {
    isNone?: boolean;
    unwrap?: () => { toString(): string };
  };
  if (next.isNone || !next.unwrap) return 0;
  const value = Number(next.unwrap().toString());
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function buildCollectionMintTx(api: ApiPromise, params: CollectionMintParams) {
  const calls = [
    api.tx.nfts.create(params.admin, {
      settings: params.settings,
      maxSupply: params.maxSupply,
      mintSettings: {
        mintType: params.publicMint ? "Public" : "Issuer",
        price: params.price,
        startBlock: null,
        endBlock: null,
        defaultItemSettings: params.itemSettings,
      },
    }),
    api.tx.nfts.setCollectionMetadata(params.collectionId, params.collectionMetadata),
    api.tx.nfts.mint(
      params.collectionId,
      params.itemId,
      params.mintTo,
      params.price === null ? null : { ownedItem: null, mintPrice: params.price },
    ),
  ];
  if (params.itemMetadata) {
    calls.push(api.tx.nfts.setMetadata(params.collectionId, params.itemId, params.itemMetadata));
  }
  return api.tx.utility.batchAll(calls);
}

export function collectionIdFromEvents(result: {
  events?: Array<{ event: { section: string; method: string; data: Array<{ toString(): string }> } }>;
}): string | undefined {
  for (const record of result.events ?? []) {
    if (record.event.section === "nfts" && record.event.method === "Created") {
      return record.event.data[0]?.toString();
    }
  }
  return undefined;
}

export function createdCollectionUpdate(result: {
  events?: Array<{ event: { section: string; method: string; data: Array<{ toString(): string }> } }>;
}): Partial<TxUpdate> {
  const collectionId = collectionIdFromEvents(result);
  return collectionId ? { collectionId } : {};
}

export async function readCollectionList(api: ApiPromise): Promise<CollectionSummary[]> {
  const next = (await api.query.nfts.nextCollectionId()) as unknown as {
    isNone?: boolean;
    unwrap?: () => { toString(): string };
  };
  if (next.isNone || !next.unwrap) return [];
  const nextId = Number(next.unwrap().toString());
  if (!Number.isInteger(nextId) || nextId <= 0) return [];
  const limit = Math.min(nextId, 100);
  const rows: CollectionSummary[] = [];
  for (let id = 0; id < limit; id += 1) {
    const stored = (await api.query.nfts.collection(id)) as unknown as {
      isNone?: boolean;
      unwrap?: () => { owner: { toString(): string }; items: { toString(): string } };
    };
    if (stored.isNone || !stored.unwrap) continue;
    const details = stored.unwrap();
    rows.push({
      id: String(id),
      owner: details.owner.toString(),
      items: details.items.toString(),
    });
  }
  return rows;
}

export async function readCollectionProfile(api: ApiPromise, id: string): Promise<CollectionProfile> {
  const empty: CollectionProfile = {
    id,
    found: false,
    owner: null,
    items: null,
    itemMetadatas: null,
    ownerDeposit: null,
    metadata: null,
    settings: null,
    maxSupply: null,
    mintType: null,
    price: null,
    roles: null,
  };
  const stored = (await api.query.nfts.collection(id)) as unknown as {
    isNone?: boolean;
    unwrap?: () => {
      owner: { toString(): string };
      items: { toString(): string };
      itemMetadatas: { toString(): string };
      ownerDeposit: { toString(): string };
    };
  };
  if (stored.isNone || !stored.unwrap) return empty;
  const details = stored.unwrap();
  const [metadata, config, roles] = await Promise.all([
    api.query.nfts.collectionMetadataOf(id),
    api.query.nfts.collectionConfigOf(id),
    api.query.nfts.collectionRoleOf(id, details.owner.toString()),
  ]);
  const meta = metadata as unknown as {
    isNone?: boolean;
    unwrap?: () => { data?: { toUtf8?: () => string } };
  };
  type ConfigValue = {
    settings: { toNumber?: () => number; toString?: () => string };
    maxSupply?: { isNone?: boolean; unwrap?: () => { toString(): string }; toString?: () => string };
    mintSettings: {
      mintType: { toString(): string };
      price?: { isNone?: boolean; unwrap?: () => { toString(): string } };
    };
  };
  const configValue = config as unknown as {
    isNone?: boolean;
    unwrap?: () => ConfigValue;
    settings?: ConfigValue["settings"];
    maxSupply?: ConfigValue["maxSupply"];
    mintSettings?: ConfigValue["mintSettings"];
  };
  const roleValue = roles as unknown as {
    isNone?: boolean;
    unwrap?: () => { toNumber?: () => number; toString?: () => string };
  };
  const unwrapped = configValue.isNone
    ? null
    : configValue.unwrap
      ? configValue.unwrap()
      : configValue.settings && configValue.mintSettings
        ? (configValue as ConfigValue)
        : null;
  const settingsNumber = unwrapped?.settings.toNumber?.() ?? Number(unwrapped?.settings.toString?.() ?? "NaN");
  const price = unwrapped?.mintSettings.price;
  return {
    id,
    found: true,
    owner: details.owner.toString(),
    items: details.items.toString(),
    itemMetadatas: details.itemMetadatas.toString(),
    ownerDeposit: details.ownerDeposit.toString(),
    metadata: meta.isNone ? null : textOf(meta.unwrap?.().data),
    settings: Number.isInteger(settingsNumber) ? settingsNumber : null,
    maxSupply: unwrapped?.maxSupply?.isNone ? "None" : unwrapped?.maxSupply?.unwrap?.().toString() ?? null,
    mintType: unwrapped?.mintSettings.mintType.toString() ?? null,
    price: price?.isNone ? null : price?.unwrap?.().toString() ?? null,
    roles: roleValue.isNone
      ? 0
      : roleValue.unwrap?.().toNumber?.() ?? Number(roleValue.unwrap?.().toString?.() ?? "0"),
  };
}

export async function readItemProfile(
  api: ApiPromise,
  collectionId: string,
  itemId: string,
): Promise<ItemProfile> {
  const stored = (await api.query.nfts.item(collectionId, itemId)) as unknown as {
    isNone?: boolean;
    unwrap?: () => { owner: { toString(): string } };
  };
  if (stored.isNone || !stored.unwrap) return { found: false, owner: null, metadata: null };
  const metadata = (await api.query.nfts.itemMetadataOf(collectionId, itemId)) as unknown as {
    isNone?: boolean;
    unwrap?: () => { data?: { toUtf8?: () => string } };
  };
  return {
    found: true,
    owner: stored.unwrap().owner.toString(),
    metadata: metadata.isNone ? null : textOf(metadata.unwrap?.().data),
  };
}

export function hasBit(value: number | null, bit: number): boolean | null {
  if (value === null) return null;
  return (value & bit) === bit;
}
