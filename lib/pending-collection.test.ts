import assert from "node:assert/strict";
import test from "node:test";
import { launchStage, parsePendingLaunch, pendingStorageKey, sameLaunchAccount, updateLaunch, type PendingCollectionLaunch } from "./pending-collection.ts";

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

test("both NFT routes can resume a finalized create and never start a second collection after interruption", () => {
  const initial = { ...record(), collectionId: null, createHash: null, createStatus: "signing" as const };
  assert.equal(launchStage(initial), "create-pending");
  const included = updateLaunch(initial, "create", { status: "included", hash: HASH, collectionId: "207" });
  assert.equal(launchStage(included), "create-pending");
  const finalized = updateLaunch(included, "create", { status: "finalized", hash: HASH });
  const reloaded = parsePendingLaunch(JSON.stringify(finalized))!;
  assert.equal(launchStage(reloaded), "ready-to-finish");
  assert.equal(reloaded.collectionId, "207");
  assert.deepEqual(reloaded.settings, initial.settings);
  const finishing = updateLaunch(reloaded, "finish", { status: "ambiguous", hash: HASH });
  assert.equal(launchStage(parsePendingLaunch(JSON.stringify(finishing))), "finish-pending");
  assert.equal(launchStage(updateLaunch(finishing, "finish", { status: "failed", hash: HASH })), "ready-to-finish");
  assert.equal(launchStage(updateLaunch(finishing, "finish", { status: "finalized", hash: HASH })), "complete");
  assert.equal(launchStage(updateLaunch(reloaded, "finish", { status: "ambiguous", notBroadcast: true })), "ready-to-finish");
});

test("saved NFT settings cannot inject call authority or accept out-of-range item IDs", () => {
  const saved = record();
  const parsed = parsePendingLaunch(JSON.stringify({ ...saved, settings: { ...saved.settings, admin: "attacker" } }))!;
  assert.equal("admin" in parsed.settings, false);
  assert.equal(parsePendingLaunch(JSON.stringify({ ...saved, settings: { ...saved.settings, itemId: 4_294_967_296 } })), null);
  assert.equal(parsePendingLaunch(JSON.stringify({ ...saved, settings: { ...saved.settings, price: "not-a-price" } })), null);
});
