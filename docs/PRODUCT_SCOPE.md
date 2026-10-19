# PORTOVA product scope

Status: Phase 0 scope. Not built.

## Product

PORTOVA is a non-custodial creation and trading app for Portaldot V3.

Tagline: Create. Launch. Trade. Own.

The job is one creator workspace that can deploy a fungible token, launch an NFT collection, open a pool, and list NFTs, with every balance tied to a chain read.

The competitive claim is the connected lifecycle on this chain, not a longer feature list than Uniswap or Magic Eden. Those products are quality benchmarks only.

## Users

- A creator who can use a Substrate wallet and, when a Revive contract is involved, MetaMask.
- A participant who discovers a project, mints, swaps, or buys an NFT.
- No custodial account, email login, or key export in the first release.

Testnet POT is distributed by the hackathon operators to the native address submitted at registration. PORTOVA does not run a faucet and does not ask for a seed phrase.

## Networks in scope

- In scope: Portaldot V3 Test, chain id 420420777, Substrate `wss://test-node-v3.portaldot.dev`, EVM `https://test-evm-rpc-v3.portaldot.dev`.
- Out of scope: legacy mainnet `wss://mainnet.portaldot.io`, any guessed V3 mainnet URL, and every other chain.

## Module scope

### In the hackathon slice

Token launch

- Create an `Assets` token with name, symbol, decimals, and supply minted to stated accounts.
- Show owner, issuer, admin, and freezer.
- Public token page fed by on-chain metadata.
- Deployment cost shown from a dry-run or fee query when the node returns one. Otherwise the cost is labeled unavailable.

NFT studio

- Create an `Nfts` collection.
- Metadata URI and a disclosure of whether metadata is locked.
- Public mint with price, supply cap, and per-wallet limit when the pallet's mint settings support them.
- Creator withdraws mint proceeds by an explicit transfer. The app does not forward them into a pool.

Swap and liquidity

- Discover `AssetConversion` pools.
- Quote and swap only when reserves exist.
- Create a pool, add liquidity, remove liquidity, and show the LP balance.
- Slippage and minimum received are required fields on every swap.

Market

- Collection and item pages.
- Fixed-price list, cancel, and buy through `Nfts.set_price` and `buy_item`.
- Owner read from chain.
- Activity from indexed events once the indexer exists. Before that, activity says unavailable.

Creator OS

- One project linking the asset id, collection id, pool id, and proceeds account.
- Status per stage: not started, submitted, included, failed, unavailable.
- Treasury balance is the on-chain balance of the proceeds account. It is not a second ledger.

Shell

- Overview, Explore, Token Launchpad, NFT Launchpad, Swap, Liquidity, NFT Marketplace, Creator Studio, Portfolio, Treasury, Activity, Settings.
- Search, network chip, wallet, account, and transaction tray.

### Explicitly later

- Vesting and allowlists for a created asset. Native `Vesting` does not do this.
- Marketplace protocol fees and creator royalties. The NFT pallet metadata has price and buy calls and no royalty field.
- Auctions, collection offers, item offers.
- Cross-chain bridge. No `IBridge` pallet is in the testnet runtime.
- ink! contracts.
- A custom AMM. Only if `AssetConversion.create_pool` fails a testnet proof.
- Mainnet deployment.
- Mobile WalletConnect, until a wallet is shown to work.

### Never in this design

- Fabricated balances, TVL, volume, floor price, or charts.
- A swap quote with no pool.
- A confirmation that is only a submitted hash.
- Silent transfer of NFT proceeds into liquidity.
- A claim of atomic launch-to-market. Each stage is its own signed extrinsic.
- Private-key or seed custody.

## Flagship journey

The creator path is fourteen steps. Each is a separate authorization.

1. Connect the Substrate wallet. Connect MetaMask only when a Revive action is about to be signed.
2. Create a local project record.
3. Deploy the fungible token with `Assets`.
4. Configure allocations by minting to the stated accounts, or stop and mark vesting unavailable.
5. Create the NFT collection.
6. Configure the public mint.
7. Mint one NFT and keep the extrinsic hash.
8. Leave mint proceeds in the creator account. Show that balance as treasury.
9. Create a pool for the token and native POT, after the asset-id codec is known.
10. Add liquidity with a second signature.
11. Swap against that pool from a second account.
12. List an NFT.
13. Buy it from the second account.
14. Show the four on-chain objects on the project page.

Recovery: a failed extrinsic stays failed, with the node error. The next step does not run. A missing indexer does not hide a successful extrinsic; the hash can still be opened in the node console.

## Hackathon fit

Event: Portaldot Hacker House 2026, track 4, Ecosystem DApps.

Published requirements that affect the build:

- Use Portaldot V3 features and deploy on the Portaldot testnet.
- Code produced primarily from 2026-10-14 through 2026-11-06. This workspace was empty on 2026-10-19.
- DoraHacks requires a Git repository link and a demo video.
- Deadline on the DoraHacks page: 2026-11-06 04:00.
- A 2026-10-12 post moved office hours, demo day (to Nov 8–9), community voting, and the winners announcement (to Nov 11). It did not change the Nov 6 submission time. Re-check Discord before submission.
- Prize text in the 2026-09-28 article: 5,200 USDT total, split half USDT and half POT, with a grand prize and per-track awards. Track awards can be withheld. This file is not a submission.

Eligibility is not confirmed here. Registration is a separate action on DoraHacks. Using `Assets`, `Nfts`, and `AssetConversion` is original integration work on this runtime, and it must be described as use of Polkadot SDK pallets rather than as a from-scratch exchange.
