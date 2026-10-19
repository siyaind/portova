import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLECTION_SETTING,
  ITEM_SETTING,
  collectionMintSteps,
  disabledCollectionSettings,
  featureEnabled,
} from "./nft-settings.ts";

test("default collection creation writes metadata before locking it", () => {
  const steps = collectionMintSteps({
    transferable: true,
    metadataEditable: false,
    lockMaxSupply: false,
    hasItemMetadata: false,
  });
  assert.deepEqual(
    steps.map((step) => step.call),
    ["create", "setCollectionMetadata", "mint", "lockCollection", "lockItemProperties"],
  );
  const create = steps[0];
  assert.equal(create.call, "create");
  if (create.call !== "create") return;
  assert.equal(create.settings, 0);
  assert.equal(create.itemSettings, 0);
  assert.equal(create.settings & COLLECTION_SETTING.DepositRequired, 0);
  assert.equal(featureEnabled(create.settings, COLLECTION_SETTING.UnlockedMetadata), true);
  const lock = steps.find((step) => step.call === "lockCollection");
  assert.ok(lock && lock.call === "lockCollection");
  if (lock?.call === "lockCollection") {
    assert.equal(lock.lockSettings, COLLECTION_SETTING.UnlockedMetadata);
  }
  assert.ok(steps.findIndex((step) => step.call === "setCollectionMetadata") < steps.findIndex((step) => step.call === "lockCollection"));
});

test("collection metadata is set while the collection is still editable", () => {
  const steps = collectionMintSteps({
    transferable: false,
    metadataEditable: false,
    lockMaxSupply: true,
    hasItemMetadata: false,
  });
  const create = steps[0];
  assert.equal(create.call, "create");
  if (create.call !== "create") return;
  assert.equal(create.settings, COLLECTION_SETTING.TransferableItems + COLLECTION_SETTING.UnlockedMaxSupply);
  assert.equal(create.settings & COLLECTION_SETTING.UnlockedMetadata, 0);
  assert.equal(steps.filter((step) => step.call === "setCollectionMetadata").length, 1);
});

test("item metadata is written after mint and before the lock", () => {
  const steps = collectionMintSteps({
    transferable: true,
    metadataEditable: false,
    lockMaxSupply: false,
    hasItemMetadata: true,
  });
  const names = steps.map((step) => step.call);
  assert.ok(names.indexOf("mint") < names.indexOf("setItemMetadata"));
  assert.ok(names.indexOf("setItemMetadata") < names.indexOf("lockItemProperties"));
  const itemLock = steps.find((step) => step.call === "lockItemProperties");
  assert.deepEqual(itemLock, { call: "lockItemProperties", lockMetadata: true, lockAttributes: false });
});

test("editable metadata does not lock the collection or the item", () => {
  const steps = collectionMintSteps({
    transferable: true,
    metadataEditable: true,
    lockMaxSupply: false,
    hasItemMetadata: true,
  });
  assert.deepEqual(steps.map((step) => step.call), ["create", "setCollectionMetadata", "mint", "setItemMetadata"]);
  assert.equal(disabledCollectionSettings({ transferable: true, lockMaxSupply: false }) & COLLECTION_SETTING.UnlockedMetadata, 0);
  const create = steps[0];
  if (create.call === "create") assert.equal(create.itemSettings & ITEM_SETTING.UnlockedMetadata, 0);
});
