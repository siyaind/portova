import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLECTION_SETTING,
  ITEM_SETTING,
  disabledCollectionSettings,
  disabledItemSettings,
  featureEnabled,
} from "./nft-settings.ts";

test("default collection leaves transfer on and locks metadata", () => {
  const bits = disabledCollectionSettings({
    transferable: true,
    metadataEditable: false,
    lockMaxSupply: false,
  });
  assert.equal(bits, COLLECTION_SETTING.UnlockedMetadata);
  assert.equal(bits & COLLECTION_SETTING.DepositRequired, 0);
  assert.equal(featureEnabled(bits, COLLECTION_SETTING.TransferableItems), true);
  assert.equal(featureEnabled(bits, COLLECTION_SETTING.UnlockedMetadata), false);
  assert.equal(featureEnabled(bits, COLLECTION_SETTING.DepositRequired), true);
});

test("non-transferable collection sets only the disable bit", () => {
  const bits = disabledCollectionSettings({
    transferable: false,
    metadataEditable: true,
    lockMaxSupply: false,
  });
  assert.equal(bits, COLLECTION_SETTING.TransferableItems);
  assert.equal(featureEnabled(bits, COLLECTION_SETTING.TransferableItems), false);
});

test("a supply cap locks max supply and still omits DepositRequired", () => {
  const bits = disabledCollectionSettings({
    transferable: true,
    metadataEditable: true,
    lockMaxSupply: true,
  });
  assert.equal(bits, COLLECTION_SETTING.UnlockedMaxSupply);
  assert.equal(bits & COLLECTION_SETTING.DepositRequired, 0);
});

test("item settings use the same disabled-bit rule", () => {
  const bits = disabledItemSettings({ transferable: true, metadataEditable: false });
  assert.equal(bits, ITEM_SETTING.UnlockedMetadata);
  assert.equal(disabledItemSettings({ transferable: false, metadataEditable: true }), ITEM_SETTING.Transferable);
});
