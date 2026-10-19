export type BuildCall = {
  id: string;
  phase: string;
  call: string;
  detail: string;
};

export const BUILD_CALLS: BuildCall[] = [
  {
    id: "asset",
    phase: "2",
    call: "utility.batchAll(assets.create, assets.setMetadata, assets.mint)",
    detail: "No hash from this app is on file. Asset metadata already on the testnet is not attributed to this call.",
  },
  {
    id: "nft",
    phase: "3",
    call: "utility.batchAll(nfts.create, nfts.setCollectionMetadata, nfts.mint, nfts.setMetadata)",
    detail: "No hash from this app is on file.",
  },
  {
    id: "pool",
    phase: "4",
    call: "assetConversion.createPool",
    detail: "No hash from this app is on file. An empty pool list is a storage read, not a failed extrinsic.",
  },
  {
    id: "add",
    phase: "4",
    call: "assetConversion.addLiquidity",
    detail: "No hash from this app is on file.",
  },
  {
    id: "remove",
    phase: "4",
    call: "assetConversion.removeLiquidity",
    detail: "No hash from this app is on file.",
  },
  {
    id: "swap",
    phase: "4",
    call: "assetConversion.swapExactTokensForTokens",
    detail: "No hash from this app is on file. Swap stays off unless the node returns a quote.",
  },
  {
    id: "list",
    phase: "5",
    call: "nfts.setPrice",
    detail: "No hash from this app is on file.",
  },
  {
    id: "buy",
    phase: "5",
    call: "nfts.buyItem",
    detail: "No hash from this app is on file.",
  },
  {
    id: "transfer",
    phase: "6",
    call: "balances.transfer",
    detail: "Withdrawal is not built. No hash exists, and proceeds are not moved into a pool.",
  },
];
