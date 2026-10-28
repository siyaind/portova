import type { ApiPromise } from "@polkadot/api";
import { sameAccount } from "./withdrawal.ts";

export async function checkAssetMint(api: ApiPromise, id: string, signer: string) {
  const at = await api.at(await api.rpc.chain.getFinalizedHead());
  const asset = await at.query.assets.asset(id);
  const value = asset.toJSON() as { issuer?: string; status?: string } | null;
  if (!value || !sameAccount(value.issuer, signer)) throw Error("Only the current asset issuer can mint. No wallet request was opened.");
  if (String(value.status).toLowerCase() !== "live") throw Error("This asset is not live. Minting is unavailable.");
}

export async function checkNftMint(api: ApiPromise, id: string, itemId: number, signer: string) {
  const at = await api.at(await api.rpc.chain.getFinalizedHead());
  const [item, collection, config, role] = await Promise.all([
    at.query.nfts.item(id, itemId), at.query.nfts.collection(id),
    at.query.nfts.collectionConfigOf(id), at.query.nfts.collectionRoleOf(id, signer),
  ]);
  if (item.toJSON() !== null) throw Error("This NFT item ID already exists. Choose an unused ID; nothing was submitted.");
  const details = collection.toJSON() as { items?: number } | null;
  const settings = config.toJSON() as { maxSupply?: number | null; mintSettings?: { mintType?: unknown; startBlock?: number | null; endBlock?: number | null } } | null;
  if (!details || !settings?.mintSettings) throw Error("The collection or mint permissions could not be read.");
  if (settings.maxSupply != null && Number(details.items) >= Number(settings.maxSupply)) throw Error("This collection has reached its maximum supply.");
  const mintType = settings.mintSettings.mintType;
  const type = (typeof mintType === "string" ? mintType : mintType && typeof mintType === "object" ? Object.keys(mintType)[0] ?? "" : "").toLowerCase();
  const issuer = (Number(role.toJSON()) & 1) !== 0;
  if (type === "issuer" && !issuer) throw Error("Only a current collection issuer can mint this NFT. No wallet request was opened.");
  if (type !== "issuer" && type !== "public") throw Error("This mint type needs a holder witness, which this form does not support.");
  const height = Number((await at.query.system.number()).toString());
  if ((settings.mintSettings.startBlock != null && height < settings.mintSettings.startBlock) || (settings.mintSettings.endBlock != null && height > settings.mintSettings.endBlock)) throw Error("The collection's public mint window is not open.");
}
