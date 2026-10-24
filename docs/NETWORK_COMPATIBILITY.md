# Network compatibility

Verified October 24, 2026. The official [V3 rollout announcement](https://x.com/PortaldotL0/status/2113571842917269526) scheduled rollout for October 23 at 23:00 UTC (October 24, 04:30 IST). The [official developer endpoint post](https://x.com/Portaldot_Dev/status/2113571130527318088) publishes separate mainnet and testnet services.

## Portova configuration

| Setting | Verified value |
|---|---|
| Chain | PortaldotV3 Test |
| Spec | portaldot-v3 3002 |
| Genesis | 0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd |
| Substrate | wss://test-node-v3.portaldot.dev |
| EVM | https://test-evm-rpc-v3.portaldot.dev |
| EVM chain id | 420420777 |
| Native | tPOT, 14 decimals, SS58 42 |
| Testnet explorer | https://scanner-testnet-v3.portaldot.dev |

At finalized block 174536 (2026-10-24 12:22:24 UTC), there were 21 assets, 11 Nfts collections and 9 AssetConversion pools. Nfts.Features was 0, so Trading stays disabled. Counts change as other participants transact.

[Machine-readable snapshot](submission/network-evidence.json). Reproduce with `node --experimental-strip-types scripts/verify-testnet.mjs`; this script only reads public data.

## Supported product paths

Assets, Nfts, AssetConversion, System and Balances are available on this testnet. Swaps use runtime quotes and actual reserves. Pools exist; old documentation saying there were no pools described the October 19 baseline and is superseded.

The official explorer supports hash routes of the form `/#/extrinsics/0x…` and block routes `/#/blocks/159687`. A historical app swap was recovered directly at block 159687 and verified as successful/finalized, well outside 24 blocks.

## Mainnet and EVM limits

The announcement publishes mainnet explorer https://scanner-live-v3.portaldot.dev and node console https://node-console.portaldot.dev. Portova keeps the testnet endpoint and genesis. A separate read of legacy wss://mainnet.portaldot.io returned spec portaldot 1002; it is not used by this product and does not establish the V3 mainnet configuration.

The EVM chain descriptor uses 18 decimals for EVM tooling. Substrate balances use 14 decimals. No balance conversion ratio or custom Revive contract is claimed. The current frontend signs runtime pallet calls through a Substrate wallet.

## Sources

- [Official endpoint announcement](https://x.com/Portaldot_Dev/status/2113571130527318088)
- [Official event network information and requirements](https://dorahacks.io/hackathon/portaldot-hacker-house-2026/detail)
- [Testnet guide translation](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide) — older guide material; newer official announcements take precedence.
