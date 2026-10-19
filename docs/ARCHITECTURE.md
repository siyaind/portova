# PORTOVA architecture

Status: Phase 0 decision. Not implemented.

Date: 2026-10-19

## Decision

Build PORTOVA as a Portaldot V3 testnet application whose financial state comes from runtime pallets first and from Revive contracts only where a pallet cannot express the rule.

Do not deploy a new AMM. `AssetConversion` is already in the runtime. It has no pools today, so the swap screen stays non-executable until a pool with reserves exists.

Do not integrate iSwap or the marketed NFT launchpad. Neither has a verifiable on-chain API.

Do not add a V3 mainnet chain config. No V3 mainnet RPC was verified. The live chain at `wss://mainnet.portaldot.io` is the legacy 2.0 runtime.

## Why this shape

The testnet runtime `portaldot-v3` spec 3002 already contains:

- `Assets` for fungible tokens, roles, mint, burn, metadata, and approvals. Two assets already have metadata on chain.
- `Nfts` for collections, mint settings, pre-signed mint, item price, and `buy_item`.
- `AssetConversion` with `create_pool` and `create_pool_with_fee`. Upstream, this pallet is a constant-product AMM. This runtime's asset-id encoding and fee constants still have to be read from metadata before a pool call is built.
- `Revive` plus an `eth-rpc` process. At least one address serves Solidity bytecode (`0x6080604052...`). Seven code-info records exist.
- `Vesting` for the native balance only.
- `Contracts` for ink!, with no deployed contracts found and no documented call path into Revive.

A Solidity factory that mints ERC-20 tokens would create a second token system that does not automatically enter `AssetConversion`. That splits the product. Native assets keep creation, liquidity, and balances in one asset id space.

Revive remains the path for rules the pallets do not implement: vesting of a created asset, allowlist claims, and a marketplace fee. Those contracts are later phases. Each one starts with a tiny testnet deploy, not with a copied DEX.

## Client architecture

One Next.js TypeScript app.

Two chain clients, one source of truth per asset class:

| Concern | Client | Authority |
|---|---|---|
| POT balance, assets, NFT ownership, pools, listings | `@polkadot/api` over `wss://test-node-v3.portaldot.dev` | Substrate storage and events |
| Wallet signing for those calls | `@polkadot/extension-dapp` (Polkadot.js, Talisman, SubWallet, and compatible injectors) | User signature |
| Revive contract reads and, later, Solidity calls | `viem` and `wagmi` against `https://test-evm-rpc-v3.portaldot.dev`, chain id 420420777 | EVM tip state |
| EVM signing | MetaMask or another injected EIP-1193 wallet | User signature |

The native symbol on chain is `tPOT` with 14 decimals. The guide tells MetaMask users to type `tPOTv3`. The EVM RPC may scale balances into 18-decimal wei through Revive's native-to-ETH ratio. That storage value was empty under the name `NativeToEthRatio`, so the ratio is not proven. Until a funded account is compared on both APIs, POT shown in the EVM wallet is labeled unverified. Substrate `System.Account` is the balance the dashboard trusts.

H160 addresses are not Ethereum addresses for the same key. Funding from the node console requires `reviveApi.accountId`. The app must show that mapped address before a user sends native POT. There is no documented recovery for a transfer sent to a raw H160.

Mobile WalletConnect is unknown. Phase 1 targets desktop injected wallets.

## Server and data

Phase 1 does not need a database. Screens read the chain or show an empty state.

An indexer becomes necessary before history, analytics, or receipt lists can be trusted. Reason: on 2026-10-19 the EVM RPC returned `State already discarded` for historical blocks, and it returned a null receipt for a transaction hash that `eth_getLogs` still listed. Substrate still returned the header of block 100.

The later indexer subscribes to Substrate blocks, decodes `Assets`, `Nfts`, `AssetConversion`, and `Revive` events, and stores them in PostgreSQL. It does not invent fills. If the node has not reported an event, the UI says unavailable.

Project names, descriptions, and draft launch configuration that are not on chain live in the app database and are labeled off-chain. Ownership, balances, mint results, pool reserves, and sale settlement stay on chain.

NFT metadata files need a content address. IPFS is acceptable only with an explicit pinning plan. The NFT record stores the URI and whether the collection metadata is locked. Mutability is disclosed, not hidden.

## Smart-contract boundary

Do not create the full candidate set from the master prompt. Map responsibilities onto what the chain already runs.

| Need | Phase 0 choice | Contract to write |
|---|---|---|
| Fungible token | `Assets.create`, metadata, issuer, admin, freezer | None in the first token slice |
| Renounce mint | Freeze or clear the issuer role and show the resulting admin set | None |
| Native POT vesting | Existing `Vesting` pallet, if a schedule is actually required for POT | None |
| Creator-token allocations | Not available in `Assets` | Later Revive vesting or claim contract, after a bytecode probe. Until then, an issuer mint is shown as an admin power |
| NFT collection and primary sale | `Nfts` collection config, mint settings, price | None in the first NFT slice |
| POT-priced secondary sale | `Nfts.set_price` and `buy_item` | None for the basic sale |
| Protocol fee or royalties | Not present in NFT metadata | Later marketplace contract. Do not pretend `buy_item` takes a fee |
| Pool, LP, swap | `AssetConversion` | None, unless a testnet `create_pool` fails for ordinary assets |
| Swap quote | Runtime quote API once the call encoding is known | None. No quote without reserves |
| Treasury | A project account or proxy. Withdrawals are explicit extrinsics | No hidden sweep into a pool |

If a custom contract is required later, it uses a minimal own interface, OpenZeppelin only if a Revive test proves those imports deploy, access control, reentrancy guards, and tests. It is not a fork of Uniswap v2. Unaudited AMM code is not deployed, and no real value is sent to any contract in this program without a separate security review.

## Application modules

The UI modules match the product, and they call the chain as follows.

1. Launch reads and submits `Assets` calls. Profile pages read asset metadata and account balances.
2. NFT Studio reads and submits `Nfts` calls. Artwork URIs are off-chain content addresses plus on-chain metadata.
3. Swap reads `AssetConversion` reserves. The execute button stays disabled while reserves are missing.
4. Liquidity submits `create_pool`, `add_liquidity`, and `remove_liquidity` only after the asset-id codec is confirmed.
5. Market lists `Nfts` items for sale. A custom order book is not part of the first market.
6. Creator OS is a view over one project: asset id, collection id, pool id, and the account that holds proceeds. It does not move funds between those stages.

## Dashboard information architecture

Desktop shell, dark charcoal background, violet and blue used as accents, not as fills.

Left navigation:

- Overview
- Explore
- Token Launchpad
- NFT Launchpad
- Swap
- Liquidity
- NFT Marketplace
- Creator Studio
- Portfolio
- Treasury
- Activity
- Settings

Top bar:

- Search across projects the indexer knows. Before the indexer exists, search is limited to asset id, collection id, and address.
- Network chip locked to Portaldot V3 Testnet, with the chain id visible.
- Wallet button. If both wallets are connected, show both addresses and which one signs the pending action.
- Account menu.
- Transaction tray: submitted, included, finalized, failed, or unavailable. A hash is shown only after the node returns it.

Overview cards, each backed by a read or an explicit empty state:

- Connected accounts and native free balance.
- Asset balances from `Assets.Account`.
- NFT items owned, once collections exist.
- LP positions, once pools exist.
- Creator projects stored off-chain, with on-chain ids when deployed.
- Recent extrinsics from the indexer, or "history unavailable" before it runs.
- Pending items from the local transaction tracker.
- Discovery of assets and collections that exist on chain.
- Quick actions that route into the module. They do not pre-sign.

Swap terminal:

- Pair picker limited to assets that have a pool.
- Reserve and price from chain state.
- Chart only after the indexer has a real price series.
- Quote, minimum received, slippage, and deadline shown before submit.
- Price impact from reserves, not from a placeholder.
- Receipt panel waits for inclusion. It does not mark success from a submitted hash alone.

NFT market:

- Collection grid from on-chain collections.
- Empty gallery while the collection count is zero.
- Item page with owner, metadata URI, lock state, and price if `set_price` was called.
- Buy sends `buy_item` and shows the extrinsic result.

Creator Studio sections:

- Identity
- Token
- Collection
- Sale
- Treasury
- Vesting, labeled unavailable until a real schedule exists
- Liquidity
- Analytics, with unavailable charts rather than sample series
- Activity

Mobile: collapsible navigation, stacked swap form, two-column NFT grid collapsing to one, tables that become row cards. No horizontal page scroll.

## Phased roadmap

Hackathon submission deadline shown by DoraHacks: 2026-11-06 04:00. The build has to stay inside what can be demonstrated on testnet.

| Phase | Outcome | Chain work |
|---|---|---|
| 0 | This architecture. Done. | Read-only |
| 1 | Shell, design system, wallet connect, empty financial states | None |
| 2 | Create a native asset, set metadata, show it on a public page, expose issuer and admin | `Assets` extrinsics on testnet |
| 3 | Create an `Nfts` collection, set metadata, public mint, record the mint extrinsic | `Nfts` extrinsics on testnet |
| 4 | Decode `AssetConversion` asset ids, create one pool, add liquidity, swap against real reserves | Pallet calls. Stop if `create_pool` is blocked |
| 5 | List and buy one NFT with `set_price` / `buy_item` | Native calls. Fees and royalties stay out |
| 6 | One creator project view that links token, collection, pool, and proceeds account | No automatic movement of sale proceeds into the pool |
| 7 | Reconciliation of the extrinsics from phases 2–6, UI pass, deployment notes | No mainnet |

Stretch, only after phase 4 proves Revive is needed: asset vesting contract, allowlist claim, marketplace fee. Auctions, collection offers, and cross-chain bridging are out of this program.

Each phase ends with a short report and waits for approval. The next session starts from this file and `docs/BUILD_STATE.md`.
