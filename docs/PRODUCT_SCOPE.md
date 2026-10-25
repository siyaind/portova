# Product scope

Updated October 24, 2026.

October 25 addition: Creator Studio includes Creator Launch Health with finalized ownership, supply, paginated holders, LP reserves/share, a fee-excluding swap scenario and confirmed browser receipts for the reference account. Treasury is explicitly a linked-account balance/withdrawal tool. It does not attribute sales to projects or route revenue. All signing routes use a shared context guard, both NFT routes share launch recovery, and storage discovery is paginated. Details: REVIEW_FOLLOWUP.md.

PORTOVA gives creators one workspace for native testnet tokens, NFT collections, liquidity and proceeds. Signing requires an injected Substrate wallet with testnet tPOT. Browsing chain state and recovering a known receipt do not require wallet approval.

## Implemented

- Public landing page with responsive navigation, shared backgrounds and motion that respects reduced-motion settings.
- Native asset creation, metadata, minting and profile reads.
- NFT collection creation, metadata, item minting and collection profiles. Staged launch recovery is bound to its wallet.
- Native AssetConversion pools, deposits, withdrawals and exact-input swaps with quote/minimum-output review.
- One local creator project connecting a token, collection, pool and proceeds account.
- Portfolio and proceeds balance reads, plus reviewed tPOT withdrawal from the linked proceeds account.
- Browser receipts, background reconciliation, direct inclusion-block recovery, resumable old-block search and JSON backups.
- Network facts and official testnet explorer links.

## Runtime-dependent and excluded

NFT listing, cancellation and purchase stay disabled while Nfts.Features lacks Trading (0 at the captured block). No mainnet actions, custom contracts, bridge, royalties, auctions, vesting, server accounts, hosted media uploads or full historical analytics are implemented. The app does not hold funds or keys.

A runtime rollout announcement does not activate every feature in this app. Configuration remains the verified V3 testnet. Mainnet integration would require separately verified endpoints, runtime capabilities and a product decision.

## Evidence and demo

See [current build](BUILD_STATE.md), [network compatibility](NETWORK_COMPATIBILITY.md), [technical evidence](submission/EVIDENCE.md), and [demo guide](DEMO.md). Tests validate wallet orchestration with fake adapters. A new end-to-end treasury transfer still requires a human to sign in their own wallet.
