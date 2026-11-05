# Native integration evidence

Portova uses native runtime pallets rather than a custom deployed contract. Transaction evidence, saved project metadata and operator review have different meanings.

## Current testnet example

[Public project profile](https://portova.vercel.app/projects/52936ffe-9035-49d7-a579-ea8fe6f42a3b)

| Object | Identifier |
|---|---|
| Project | Portova QA Import, public cloud Revision 10 |
| Native asset | [644897333 · PQA](https://portova.vercel.app/token/644897333) |
| NFT collection | [24](https://portova.vercel.app/collection/24) |
| Pool | [LP 17](https://portova.vercel.app/liquidity?pool=17) |

The project is marked as an example. Finalized role evidence at block 326689 matched the publisher to token/collection owners for that revision. It is a snapshot, not an endorsement or permanent ownership claim.

The owner's successful asset creation finalized at block 321441: [transaction](https://scanner-testnet-v3.portaldot.dev/#/extrinsics/0x3e810935fefc897298c7f9c93f564d6038fdbd2ade2d50a0973ee16c6c9cc14b). The acceptance record reports 1000 PQA, eight decimals and matching authorities. Full rehearsal scope is in [QA](QA.md).

R8 monitoring recorded both reserve declines at block 325864: PQA raw units 10000000000 → 7428374836 and tPOT 500000000000000 → 378649643839899. The owner verified the alerts and post-withdrawal export. A reserve-change alert describes a difference between snapshots, not independently its cause.

## Historical reproducible captures

- [Network snapshot](network-evidence.json): captured October 24, including finalized block 174536 and a historical receipt.
- [Discovery snapshot](discovery-evidence.json): captured October 25; collection enumeration across storage pages at a pinned block.
- [Fee measurements](fee-measurements.json): parent-state queryInfo reconstructed for historical inclusions. These are not original wallet paymentInfo quotes; original-estimate fields remain null.

The historical [swap at block 159687](https://scanner-testnet-v3.portaldot.dev/#/extrinsics/0xf60fcae4e346fc06e0e4164ffa37c0ea0494baa73c10b72c9a491b2dbeb86095), extrinsic 1, was independently reverified with matching successful dispatch in canonical finalized state. It is not evidence of a new treasury transfer. Old counts/fees are dated observations, not live product values.

## Reproduce

```sh
npm ci
npm test
npm run typecheck
npm run build
node --experimental-strip-types scripts/verify-testnet.mjs
node --experimental-strip-types scripts/verify-discovery.mjs
node scripts/measure-fees.mjs
```

Evidence scripts query public chain data and do not request a wallet signature. RPC retention may prevent reconstruction; missing/pruned events remain unverified rather than successful by assumption.
