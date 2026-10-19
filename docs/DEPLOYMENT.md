# Deployment notes

Status: not deployed. Phase 7 does not publish a host, submit an extrinsic, or configure mainnet.

Date: 2026-10-19. Chain read at block 100872.

## Run locally

From `D:\portova`:

```
npm install
npm run dev
```

`npm run dev` starts Next.js with webpack. `npm run typecheck` runs `tsc --noEmit`. A production process is `npm run build` and then `npm run start`.

The app talks only to the public testnet endpoints in `lib/network.ts`:

- Substrate `wss://test-node-v3.portaldot.dev`
- EVM `https://test-evm-rpc-v3.portaldot.dev`
- Chain id `420420777`
- Node console `https://node-console.portaldot.dev`

No `.env` file is required. No seed, private key, or write-scoped credential belongs in the repo.

## What this phase does not deploy

- No contract, no custom AMM, and no indexer or database.
- No mainnet endpoint. Legacy `wss://mainnet.portaldot.io` is a different runtime and is not configured.
- No hosted frontend. The source is in the private repository `https://github.com/rishu4436/portova`. That repository is not a running deployment.
- No `balances.transfer`. Sale proceeds stay in the proceeds account.

## Chain read used for reconciliation

| Fact | Value at block 100872 |
|---|---|
| Chain | PortaldotV3 Test |
| Node | 3.0.0-dev-fddd43141f2 |
| Spec | portaldot-v3 3002 |
| Asset metadata | id 1 `example asset for testnet` / TST / 18 decimals; id 2 `test asset` / TEST / 18 decimals |
| Nfts collections | 0 entries |
| AssetConversion pools | 0 entries |
| Nfts.Features | 0 |
| Sudo key | Set |

Assets 1 and 2 were already stored on the testnet. They are not hashes from this app. The Activity page reads the live counts; the table above is this one read.

## Extrinsic reconciliation

Phases 2–6 can prepare the calls below. This build submitted none of them. There is no demo-script hash to match.

| Phase | Call | Hash |
|---|---|---|
| 2 | `utility.batchAll` of `assets.create`, `assets.setMetadata`, `assets.mint` | None |
| 3 | `utility.batchAll` of `nfts.create`, `nfts.setCollectionMetadata`, `nfts.mint`, `nfts.setMetadata` | None |
| 4 | `assetConversion.createPool` | None |
| 4 | `assetConversion.addLiquidity` | None |
| 4 | `assetConversion.removeLiquidity` | None |
| 4 | `assetConversion.swapExactTokensForTokens` | None |
| 5 | `nfts.setPrice` | None |
| 5 | `nfts.buyItem` | None |
| 6 | `balances.transfer` | Not built |

The local creator project is browser storage, not an extrinsic.

When a wallet later signs, the node hash is stored in this browser and shown on Activity and in the transaction tray. Included, finalized, and failed stay separate labels. After a reload the page shows the stored status and does not query that hash again. Look the hash up in the node console. The app does not invent a console path for it.

A missing indexer is labeled unavailable. It is not shown as zero volume, a zero balance, or a successful receipt. The public EVM endpoint is not used as a receipt archive.

## Checks that were not executed

No transfer was signed, so a wrong SS58 mapping was not drained on chain. No `buy_item` was signed, so a cancel race was not executed. `Nfts.Features` is 0, so list and buy stay disabled. Swap stays off while the pool list is empty and the node has no quote.
