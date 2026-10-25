import { ApiPromise, WsProvider } from "@polkadot/api";
import { readCollectionPage } from "../lib/nfts.ts";
import { readListingsPage } from "../lib/market.ts";
import { writeFile } from "node:fs/promises";
const timer = setTimeout(() => process.exit(1), 90_000);
let api;
try {
  api = await ApiPromise.create({ provider: new WsProvider("wss://test-node-v3.portaldot.dev", 2500) });
  const hash = await api.rpc.chain.getFinalizedHead(), blockHash = hash.toHex(), at = await api.at(hash);
  const collections = [];
  let page = await readCollectionPage(api, { blockHash, pageSize: 4 }), pages = 1;
  collections.push(...page.rows);
  while (page.nextCursor) { page = await readCollectionPage(api, { blockHash, cursor: page.nextCursor, pageSize: 4 }); pages++; collections.push(...page.rows); }
  const listings = await readListingsPage(api, { blockHash });
  const stored = await at.query.nfts.collection.keys();
  if (collections.length !== stored.length) throw Error("Collection pagination did not match the pinned storage map.");
  const result = { capturedAt: new Date().toISOString(), genesisHash: api.genesisHash.toHex(), blockHash, collectionPages: pages, collectionsFound: collections.length, collectionStorageKeys: stored.length, complete: page.complete,
    listingsFirstPage: { rows: listings.rows.length, entriesChecked: listings.scanned, complete: listings.complete, nextCursor: listings.nextCursor } };
  await writeFile("docs/submission/discovery-evidence.json", JSON.stringify(result, null, 2) + "\n"); console.log(JSON.stringify(result));
} finally { clearTimeout(timer); await api?.disconnect(); }
