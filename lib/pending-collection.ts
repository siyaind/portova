import type { TxUpdate, TxPhase } from "./assets.ts";
import { parseDecimalToPlanck } from "./format.ts";

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
  createStatus?: TxPhase;
  createBlockHash?: string;
  searchCursor?: number;
  finishHash?: string;
  finishStatus?: TxPhase;
  finishBlockHash?: string;
  finishSearchCursor?: number;
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
    if (!Number.isInteger(settings.itemId) || settings.itemId < 0 || settings.itemId > 4_294_967_295) return null;
    if (settings.maxSupply !== null && (!Number.isInteger(settings.maxSupply) || settings.maxSupply < 1 || settings.maxSupply > 4_294_967_295)) return null;
    if (typeof settings.publicMint !== "boolean" || typeof settings.transferable !== "boolean") return null;
    if (typeof settings.metadataEditable !== "boolean" || typeof settings.mintTo !== "string") return null;
    if (settings.price !== null && (typeof settings.price !== "string" || parseDecimalToPlanck(settings.price, 14) === null)) return null;
    const parsed: PendingCollectionLaunch = {
      genesisHash: value.genesisHash ?? "",
      payer: value.payer ?? "",
      collectionId: value.collectionId ?? null,
      createHash: value.createHash ?? null,
      settings: { collectionMetadata: settings.collectionMetadata, itemMetadata: settings.itemMetadata, itemId: settings.itemId, maxSupply: settings.maxSupply, publicMint: settings.publicMint, price: settings.price, transferable: settings.transferable, metadataEditable: settings.metadataEditable, mintTo: settings.mintTo },
      createStatus: phase(value.createStatus),
      createBlockHash: HASH.test(value.createBlockHash ?? "") ? value.createBlockHash : undefined,
      searchCursor: Number.isSafeInteger(value.searchCursor) && value.searchCursor! >= 0 ? value.searchCursor : undefined,
      finishHash: HASH.test(value.finishHash ?? "") ? value.finishHash : undefined,
      finishStatus: phase(value.finishStatus),
      finishBlockHash: HASH.test(value.finishBlockHash ?? "") ? value.finishBlockHash : undefined,
      finishSearchCursor: Number.isSafeInteger(value.finishSearchCursor) && value.finishSearchCursor! >= 0 ? value.finishSearchCursor : undefined,
    };
    return Object.fromEntries(Object.entries(parsed).filter(([, entry]) => entry !== undefined)) as PendingCollectionLaunch;
  } catch {
    return null;
  }
}

function phase(value: unknown): TxPhase | undefined {
  return typeof value === "string" && ["signing", "submitted", "included", "finalized", "failed", "ambiguous"].includes(value) ? value as TxPhase : undefined;
}
export function launchStage(record: PendingCollectionLaunch | null): "new" | "create-pending" | "ready-to-finish" | "finish-pending" | "complete" | "create-failed" {
  if (!record) return "new";
  if (record.finishStatus === "finalized") return "complete";
  if (record.finishStatus && record.finishStatus !== "failed") return "finish-pending";
  if (record.createStatus === "failed") return "create-failed";
  return record.collectionId && record.createStatus === "finalized" ? "ready-to-finish" : "create-pending";
}
export function updateLaunch(record: PendingCollectionLaunch, step: "create" | "finish", update: TxUpdate): PendingCollectionLaunch {
  const status = update.notBroadcast ? "failed" : update.status;
  if (step === "finish") return { ...record, finishHash: update.hash ?? record.finishHash, finishStatus: status, finishBlockHash: update.blockHash ?? record.finishBlockHash };
  return { ...record, createHash: update.hash ?? record.createHash, createStatus: status,
    createBlockHash: update.blockHash ?? record.createBlockHash, collectionId: update.collectionId ?? record.collectionId };
}

export function sameLaunchAccount(record: PendingCollectionLaunch, genesisHash: string, payer: string): boolean {
  return record.genesisHash === genesisHash && record.payer === payer;
}
