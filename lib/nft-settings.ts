export const COLLECTION_SETTING = {
  TransferableItems: 1,
  UnlockedMetadata: 2,
  UnlockedAttributes: 4,
  UnlockedMaxSupply: 8,
  DepositRequired: 16,
} as const;

export const ITEM_SETTING = {
  Transferable: 1,
  UnlockedMetadata: 2,
  UnlockedAttributes: 4,
} as const;

/**
 * pallet-nfts stores these bits as disabled features. Bit 0 means the feature
 * is enabled. DepositRequired must stay clear on nfts.create; setting it is
 * rejected with WrongSetting. Confirmed against pallet-nfts 26–31 source.
 * Portaldot uses the same bit values. A signed create has not been run.
 */
export function disabledCollectionSettings(input: {
  transferable: boolean;
  lockMaxSupply: boolean;
}): number {
  let bits = 0;
  if (!input.transferable) bits += COLLECTION_SETTING.TransferableItems;
  if (input.lockMaxSupply) bits += COLLECTION_SETTING.UnlockedMaxSupply;
  return bits;
}

export function disabledItemSettings(input: { transferable: boolean }): number {
  let bits = 0;
  if (!input.transferable) bits += ITEM_SETTING.Transferable;
  return bits;
}

export type MintStep =
  | { call: "create"; settings: number; itemSettings: number }
  | { call: "setCollectionMetadata" }
  | { call: "mint" }
  | { call: "setItemMetadata" }
  | { call: "lockCollection"; lockSettings: number }
  | { call: "lockItemProperties"; lockMetadata: true; lockAttributes: false };

/**
 * setCollectionMetadata and setMetadata fail once UnlockedMetadata is disabled.
 * Create and mint leave metadata editable, write the URIs, then lock.
 */
export function collectionMintSteps(input: {
  transferable: boolean;
  metadataEditable: boolean;
  lockMaxSupply: boolean;
  hasItemMetadata: boolean;
}): MintStep[] {
  const steps: MintStep[] = [
    {
      call: "create",
      settings: disabledCollectionSettings(input),
      itemSettings: disabledItemSettings(input),
    },
    { call: "setCollectionMetadata" },
    { call: "mint" },
  ];
  if (input.hasItemMetadata) steps.push({ call: "setItemMetadata" });
  if (!input.metadataEditable) {
    steps.push({
      call: "lockCollection",
      lockSettings: COLLECTION_SETTING.UnlockedMetadata,
    });
    steps.push({ call: "lockItemProperties", lockMetadata: true, lockAttributes: false });
  }
  return steps;
}

export function featureEnabled(settings: number | null, disabledBit: number): boolean | null {
  if (settings === null || !Number.isInteger(settings) || settings < 0) return null;
  return (settings & disabledBit) === 0;
}
