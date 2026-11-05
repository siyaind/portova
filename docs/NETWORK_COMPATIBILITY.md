# Network compatibility

Configuration is maintained in `lib/network.ts` and signing/worker compatibility rules in `lib/network-policy.ts`.

| Setting | Configured value |
|---|---|
| Network | Portaldot V3 Testnet |
| Reviewed runtime | `portaldot-v3:3002` |
| Genesis | `0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd` |
| Substrate RPC | `wss://test-node-v3.portaldot.dev` |
| EVM RPC | `https://test-evm-rpc-v3.portaldot.dev` |
| EVM chain ID | `420420777` |
| Native Substrate asset | tPOT, 14 decimals, SS58 prefix 42 |
| Explorer | https://scanner-testnet-v3.portaldot.dev |

The application verifies network identity and pauses signing/ingestion on unreviewed runtime changes. A network announcement does not enable mainnet or automatically approve new runtime capabilities.

Assets, Nfts, AssetConversion, System and Balances back the supported native flows. NFT listing/buying requires the runtime Trading feature; it was disabled during the recorded testnet acceptance. Counts and capabilities must be read at the current block rather than inferred from an old snapshot.

The EVM descriptor uses 18 decimals for EVM tooling. Native Substrate amounts use 14 decimals. No conversion ratio, shared account authority or custom Revive contract is implied. Optional Base USDC billing is a separate disabled service flow, not a change to the native transaction network.

Explorer links use `/#/extrinsics/0x…` or `/#/blocks/<height>`. Missing/pruned explorer data is not evidence that a transaction failed or succeeded; canonical chain receipts determine the result.

## Reproduce a read-only snapshot

```sh
node --experimental-strip-types scripts/verify-testnet.mjs
node --experimental-strip-types scripts/verify-discovery.mjs
```

The dated [network snapshot](submission/network-evidence.json) and [discovery snapshot](submission/discovery-evidence.json) are historical evidence, not current network counts. Both scripts read public data without wallet approval or submission.

Official endpoint references: [developer announcement](https://x.com/Portaldot_Dev/status/2113571130527318088) and [V3 rollout announcement](https://x.com/PortaldotL0/status/2113571842917269526). These are retained as historical sources; the configured genesis/runtime gate remains authoritative for this application.
