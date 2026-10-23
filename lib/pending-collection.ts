export type PendingLaunchSettings = {
  collectionMetadata: string;
  itemMetadata: string | null;
  itemId: number;
  maxSupply: number | null;
  publicMint: boolean;
  price: string | null;
  transferable: boolean;
  metadataEditable: boolean;
  mintTo: string;
};

export type PendingCollectionLaunch = {
  genesisHash: string;
  payer: string;
  collectionId: string | null;
  createHash: string | null;
  settings: PendingLaunchSettings;
};

const HASH = /^0x[0-9a-fA-F]{64}$/;

export function pendingStorageKey(genesisHash: string, payer: string): string {
  return `portova.pending-collection.v1:${genesisHash}:${payer}`;
}

export function parsePendingLaunch(raw: string | null): PendingCollectionLaunch | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingCollectionLaunch>;
    if (!value || typeof value !== "object" || !value.settings) return null;
    if (!HASH.test(value.genesisHash ?? "") || !value.payer) return null;
    if (value.collectionId !== null && !/^\d+$/.test(value.collectionId ?? "")) return null;
    if (value.createHash !== null && !HASH.test(value.createHash ?? "")) return null;
    const settings = value.settings;
    if (typeof settings.collectionMetadata !== "string" || !settings.collectionMetadata.trim()) return null;
    if (settings.itemMetadata !== null && typeof settings.itemMetadata !== "string") return null;
    if (!Number.isInteger(settings.itemId) || settings.itemId < 0) return null;
    if (settings.maxSupply !== null && !Number.isInteger(settings.maxSupply)) return null;
    if (typeof settings.publicMint !== "boolean" || typeof settings.transferable !== "boolean") return null;
    if (typeof settings.metadataEditable !== "boolean" || typeof settings.mintTo !== "string") return null;
    if (settings.price !== null && typeof settings.price !== "string") return null;
    return {
      genesisHash: value.genesisHash ?? "",
      payer: value.payer ?? "",
      collectionId: value.collectionId ?? null,
      createHash: value.createHash ?? null,
      settings,
    };
  } catch {
    return null;
  }
}

export function sameLaunchAccount(record: PendingCollectionLaunch, genesisHash: string, payer: string): boolean {
  return record.genesisHash === genesisHash && record.payer === payer;
}
