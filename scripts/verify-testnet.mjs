// Read-only evidence capture. Does not load a key or construct a transaction.
import { ApiPromise, WsProvider } from "@polkadot/api";
import { writeFile } from "node:fs/promises";
import { reconcileReceipt } from "../lib/tx-reconcile.ts";

const timeout = setTimeout(() => { console.error("Public RPC verification timed out."); process.exit(1); }, 90_000);
const endpoint = "wss://test-node-v3.portaldot.dev";
const expected = "0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd";
let api;
try {
  api = await ApiPromise.create({ provider: new WsProvider(endpoint, 2_500) });
  if (api.genesisHash.toHex() !== expected) throw Error("The endpoint changed its genesis hash.");
  const finalizedHash = await api.rpc.chain.getFinalizedHead();
  const at = await api.at(finalizedHash);
  const header = await api.rpc.chain.getHeader(finalizedHash);
  const [assets, collections, pools] = await Promise.all([at.query.assets.asset.keys(), at.query.nfts.collection.keys(), at.query.assetConversion.pools.keys()]);
  const hash = "0xf60fcae4e346fc06e0e4164ffa37c0ea0494baa73c10b72c9a491b2dbeb86095";
  const receipt = await reconcileReceipt(api, hash, { blockNumber: 159687 });
  const record = {
    capturedAt: new Date().toISOString(), endpoint, chain: (await api.rpc.system.chain()).toString(),
    genesisHash: expected, specName: api.runtimeVersion.specName.toString(), specVersion: api.runtimeVersion.specVersion.toNumber(),
    finalizedBlock: header.number.toNumber(), finalizedHash: finalizedHash.toHex(),
    properties: api.registry.getChainProperties()?.toJSON(),
    counts: { assets: assets.length, collections: collections.length, pools: pools.length },
    nftFeatures: at.consts.nfts.features.toString(),
    historicalReceipt: { hash, inclusionBlock: 159687, ...receipt, explorer: `https://scanner-testnet-v3.portaldot.dev/#/extrinsics/${hash}` },
  };
  await writeFile(new URL("../docs/submission/network-evidence.json", import.meta.url), JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify(record, null, 2));
} finally { clearTimeout(timeout); await api?.disconnect(); }
