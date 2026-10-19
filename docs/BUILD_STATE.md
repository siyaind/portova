# PORTOVA build state

Last updated: 2026-10-19

## Current phase

Phase 7 — extrinsic reconciliation and deployment notes: implemented, waiting for review.

The private GitHub repository is `https://github.com/rishu4436/portova` on account `rishu4436`. No custom AMM was deployed. No mainnet endpoint is configured.

Phase 1 is complete and was approved. No git commit has been made.

Phase 0 is complete and was approved. No contract is deployed. No git commit has been made.

## Repository

| Item | State |
|---|---|
| Workspace | `D:\portova` |
| Files before Phase 0 | None |
| Git | Private repository `https://github.com/rishu4436/portova` |
| Package manager / app | npm, Next.js 16. The app lives in this folder beside `docs/`. |
| Secrets | None stored |

## What Phase 0 produced

- `docs/ARCHITECTURE.md`
- `docs/NETWORK_COMPATIBILITY.md`
- `docs/PRODUCT_SCOPE.md`
- `docs/BUILD_STATE.md`
- `docs/SECURITY_MODEL.md`

## What Phase 1 produced

Next.js application shell in this folder. `npm run typecheck` and `npm run build` succeed.

Included:

- Dark shell with the twelve navigation routes, mobile drawer, search, locked testnet chip, transaction tray, and wallet dialog.
- Substrate extension connect (no signing) and injected EVM connect (no transactions). EVM native balance is not shown as tPOT.
- Live read of chain name, block number, `Assets.metadata`, `Nfts.collection` count, and `AssetConversion.pools` count.
- Account free balance and created-asset balances only after a wallet is selected.
- Swap, create, list, and pool actions are visible and disabled.

Not included: token creation, NFT minting, pool transactions, marketplace settlement, indexer, database, mainnet.

## Recommendation

CONDITIONAL GO for a Portaldot V3 testnet product.

NO-GO for mainnet and for any real-value liquidity.

## Conditions before Phase 1

1. Approve a UI-only Phase 1. No token, NFT, pool, or marketplace transaction in that phase.
2. Treat `wss://test-node-v3.portaldot.dev` and `https://test-evm-rpc-v3.portaldot.dev` as the only verified endpoints.
3. Do not claim Portaldot V3 mainnet support. No V3 mainnet RPC was published or resolved.
4. Use runtime pallets for fungible tokens, NFT collections, and liquidity. Do not start a custom AMM.
5. Keep financial screens empty or labeled unavailable until a chain read succeeds.
6. Confirm DoraHacks registration separately. This repository check cannot prove eligibility.

## What Phase 2 produced

- Token launchpad builds one `utility.batchAll` of `assets.create`, `assets.setMetadata`, and `assets.mint`.
- The signing account is the admin, so that account receives owner, issuer, admin, and freezer.
- The transaction tray records signing, submitted, included, finalized, and failed, and shows a hash only after the node returns one.
- `/token/[id]` reads supply and the four roles from the Assets pallet.
- Explore and search link to that page.
- A node `paymentInfo` on a sample batch returned a fee. No unsigned create was submitted.

## What Phase 3 produced

- NFT launchpad builds one `utility.batchAll` of `nfts.create`, `nfts.setCollectionMetadata`, `nfts.mint`, and optional `nfts.setMetadata`.
- The chain assigns the collection id. The form uses `nextCollectionId` (0 when unset) and reads the `Created` event after inclusion.
- The signer is the owner and the admin team, so that account is issuer, admin, and freezer.
- Metadata lock, transferability, optional max supply, and optional public mint price are explicit. There is no per-wallet mint cap in the pallet.
- `/collection/[id]` reads owner, mint rules, metadata, and one item. Explore lists stored collections.
- A node `paymentInfo` on a sample batch returned a fee. No unsigned create was submitted.

## What Phase 4 produced

- Liquidity uses runtime `AssetConversion` only. Asset ids are `Native` or `WithId`.
- Create pool, add liquidity, and remove liquidity are separate signed calls.
- Setup fee, LP fee, and withdrawal fee are read from pallet constants. The setup fee is 1 tPOT in native units.
- Reserves come from `getReserves`. A missing pool returns none, which is not shown as zero.
- Swap quotes use `quotePriceExactTokensForTokens` with the fee included. The swap button stays off when that quote is absent.
- A node `paymentInfo` for `createPool` and `addLiquidity` returned fees. No pool was created in this session. The chain still has 0 pools.

## What Phase 5 produced

- Marketplace calls are `nfts.set_price` (list and cancel) and `nfts.buy_item`.
- Prices are read from `itemPriceOf`. A missing price is not shown as zero.
- The runtime constant `Nfts.Features` is 0. Trading is bit 1, so list and buy stay disabled. The error for a forced call would be `MethodDisabled`.
- A node `paymentInfo` returned fees for both calls. No listing was submitted.
- The pallet still has no royalty and no marketplace fee. The bid would be paid to the seller.

## What Phase 6 produced

- Creator Studio stores one project in this browser: a name, an asset id, a collection id, a pool LP token, and a proceeds account.
- The record is labeled off-chain. The chain has no project object, and saving it does not sign.
- Each linked id is read from the pallet that owns it. A missing asset, collection, or pool stays missing. Reserves are shown only for an LP token that exists in `AssetConversion.pools`.
- Treasury shows `System.Account` free balance for the proceeds account, plus created-asset balances above zero. It does not submit `balances.transfer` and does not move proceeds into a pool.
- Vesting, charts, and indexed activity stay unavailable.
- Overview lists the same local project and its ids.

## What Phase 7 produced

- `docs/DEPLOYMENT.md` records a local-only run, the block 100872 chain read, and an empty extrinsic hash list for phases 2–6.
- Activity shows that build record beside any extrinsic this browser actually submitted. A hash is shown only when the node returned one. Reload does not re-query the hash.
- Overview uses the same session record. Indexed history stays unavailable.
- The token page states that supply can increase while the issuer role is set.
- Settings states that this build is local only.

## Gate A remediation

After the source audit of commit `6aa64ee`:

- NFT collection and item settings now use pallet-nfts disabled bits. `DepositRequired` stays clear so ordinary `nfts.create` is not sent with the flag that upstream rejects as `WrongSetting`. Metadata is written before `lockCollection` and `lockItemProperties`. A signed create has still not confirmed the runtime.
- Swap quotes are bound to the pool, direction, amount, and block. The transaction uses a fresh node quote, not a previous amount.
- Add-liquidity minimums follow the reserve ratio when reserves exist.
- Marketplace listing scans no longer repeat on every block.
- A signature that produces no hash stays unknown. A hash in a block is finalized only after `system.ExtrinsicSuccess` is read. `system.ExtrinsicFailed` is a failure. Open hashes are checked again on later blocks.
- `/run` asks the connected Substrate wallet to sign a token batch, an NFT batch, a pool, liquidity, and a swap as separate transactions. It records a hash only after the node returns one. No signed testnet extrinsic has been submitted from this workspace, so those steps are still unproven on chain. Marketplace trading stays disabled while `Nfts.Features` is 0. Creator Studio remains one browser record. There is no indexer.

## Further work

Vesting, royalties, a hosted deploy, and mainnet stay out until a separate approval. Sale proceeds still are not moved into a pool. No extrinsic from phases 2–6 was submitted.

Run the shell with `npm run dev`.

## Open blockers

See `docs/NETWORK_COMPATIBILITY.md`. The ones that change the product are:

- No verified V3 mainnet endpoint.
- Public EVM RPC drops historical state and did not return a receipt for a transaction hash that `eth_getLogs` still lists.
- Native `AssetConversion` is installed and has zero pools. Pool creation is not yet proven by a transaction.
- Native vesting covers the native balance, not creator-token schedules.
- Native NFT calls `set_price` and `buy_item` exist, and the pallet has no royalty field. `Nfts.Features` is 0, so the Trading bit is off and those calls stay disabled.
- iSwap and the marketed NFT launchpad have no verifiable on-chain integration surface.
- The testnet has a Sudo key. It is not a production trust environment.

## Hackathon clock

DoraHacks shows submission deadline 2026-11-06 04:00. Today in this session is 2026-10-19. An official timeline post on 2026-10-12 moved demo day and the winners announcement and did not change that submission deadline. Confirm the live deadline in Discord before relying on it.
