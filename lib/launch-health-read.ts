import type { ApiPromise } from "@polkadot/api";
import { readAssetProfile } from "@/lib/chain-read";
import { readCollectionProfile } from "@/lib/nfts";
import { readLpBalance, readLpSupply, readReserves, type PoolView } from "@/lib/pools";
import { type CreatorProject } from "@/lib/project";
import { storagePage, type StoragePageQuery } from "@/lib/storage-page";

type BalanceCodec = { isNone?: boolean; unwrap?: () => { balance: { toString(): string } } };
export async function readHolderPage(api: ApiPromise, assetId: string, blockHash: string, cursor?: string | null) {
  const at = await api.at(blockHash);
  const query = at.query.assets.account as unknown as StoragePageQuery<BalanceCodec>;
  const page = await storagePage({ entriesPaged: options => query.entriesPaged({ ...options, args: [assetId] }) }, cursor);
  const rows = page.entries.flatMap(([key, stored]) => {
    const address = key.args[1]?.toString(), balance = stored.isNone ? null : stored.unwrap?.().balance.toString();
    return address && balance && /^\d+$/.test(balance) && BigInt(balance) > 0n ? [{ address, balance }] : [];
  });
  return { rows, nextCursor: page.nextCursor, complete: page.complete, scanned: page.entries.length };
}
export async function readLaunchHealth(api: ApiPromise, project: CreatorProject, pool: PoolView | null, account: string | null) {
  const hash = await api.rpc.chain.getFinalizedHead(), blockHash = hash.toHex();
  const at = await api.at(hash), pinned = at as unknown as ApiPromise;
  const header = await api.rpc.chain.getHeader(hash);
  const errors: string[] = [];
  async function optional<T>(name: string, request: Promise<T>): Promise<T | null> {
    try { return await request; } catch { errors.push(`${name} could not be read at this snapshot.`); return null; }
  }
  const [asset, collection, reserves, lpSupply, lpBalance, holders] = await Promise.all([
    project.assetId ? optional("Token", readAssetProfile(pinned, project.assetId)) : null,
    project.collectionId ? optional("Collection", readCollectionProfile(pinned, project.collectionId)) : null,
    pool ? optional("Pool reserves", readReserves(pinned, pool.asset1, pool.asset2)) : null,
    pool ? optional("LP issuance", readLpSupply(pinned, pool.lpToken)) : null,
    pool && account ? optional("Linked-account LP balance", readLpBalance(pinned, pool.lpToken, account)) : null,
    project.assetId ? optional("Holder page", readHolderPage(api, project.assetId, blockHash)) : null,
  ]);
  let issuerBalance: string | null = null;
  if (asset?.issuer) {
    const stored = await optional("Issuer balance", at.query.assets.account(asset.id, asset.issuer)) as BalanceCodec | null;
    issuerBalance = stored?.isNone ? "0" : stored?.unwrap?.().balance.toString() ?? null;
  }
  return { blockHash, blockNumber: header.number.toString(), loadedAt: Date.now(), asset, collection, pool: pool && reserves ? { ...pool, reserve1: reserves[0], reserve2: reserves[1] } : null, lpSupply, lpBalance, holders, issuerBalance, errors };
}
