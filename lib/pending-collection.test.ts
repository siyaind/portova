import assert from "node:assert/strict";
import test from "node:test";
import { parsePendingLaunch, pendingStorageKey, sameLaunchAccount, type PendingCollectionLaunch } from "./pending-collection.ts";

const HASH = `0x${"ab".repeat(32)}`;

function record(payer = "alice"): PendingCollectionLaunch {
  return {
    genesisHash: HASH,
    payer,
    collectionId: "7",
    createHash: `0x${"cd".repeat(32)}`,
    settings: {
      collectionMetadata: "ipfs://collection",
      itemMetadata: "ipfs://item",
      itemId: 0,
      maxSupply: 1,
      publicMint: false,
      price: null,
      transferable: true,
      metadataEditable: false,
      mintTo: payer,
    },
  };
}

test("a pending launch resumes only for the same wallet and chain", () => {
  const saved = record();
  const raw = JSON.stringify(saved);
  const parsed = parsePendingLaunch(raw);
  assert.deepEqual(parsed, saved);
  assert.equal(parsePendingLaunch("7"), null);
  assert.equal(sameLaunchAccount(saved, HASH, "alice"), true);
  assert.equal(sameLaunchAccount(saved, HASH, "bob"), false);
  assert.equal(sameLaunchAccount(saved, `0x${"11".repeat(32)}`, "alice"), false);
  assert.match(pendingStorageKey(HASH, "alice"), /alice/);
});
