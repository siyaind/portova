# Build state

Updated October 25, 2026. This document describes the current implementation; earlier phase snapshots remain in Git history.

Latest follow-up: `/launch` provides a saved guided creator journey with finalized object linking, optional native liquidity and Launch Health. Balance snapshots expose freshness/partial reads, discovery no longer gates network readiness, NFT/receipt/project storage coordinates across tabs, and wallet-modal accessibility/security headers are improved. 84 automated tests pass. Details: [GUIDED_LAUNCH.md](GUIDED_LAUNCH.md). Real-wallet acceptance remains assigned to the owner.

October 25 code follow-up: all signing routes share context guards; both NFT routes share durable launch recovery; discovery uses storage pages; receipts record estimated and actual fees; Studio includes Creator Launch Health. The coding checks pass with 68 tests. Real-wallet testing is assigned to the user. Details: REVIEW_FOLLOWUP.md.

October 24 production baseline: https://portova.vercel.app, deployment dpl_7av1mpCeeDfQQTpWHVmCSZiNf7La, verified READY on October 24. Subsequent releases build from GitHub main; see its Actions and Vercel checks for the current revision.

| Item | Delivered | Validation |
|---|---|---|
| Treasury withdrawal | Two-step review, proceeds authority, prefix-42 recipient, 14-decimal amount, keep-alive transfer, fee/balance guard, 60-second review, receipt | Mock wallet and permission tests; human wallet signature still required for a new transfer |
| Wallet behavior | Rejection handling, permission/account updates, disconnect invalidation, account-bound review, guarded post-sign broadcast | Unit tests exercise real submission orchestration with fake adapters; no seed or private key used |
| Receipt recovery | Inclusion hash/height saved, exact old-block lookup, paged search with persisted cursor, global recovery, export/import | Reload/storage tests and successful public RPC recovery of block 159687 |
| Documentation | README, architecture, scope, security, network, deployment and demo refreshed | Facts linked to official announcement, event page and captured RPC evidence |
| Demo package | Live 60-second walkthrough, technical evidence, requirements checklist and QA record | Published at /demo/index.html; final event materials and entry updates remain team actions |

## Current chain evidence

At finalized block 174536, captured 2026-10-24 12:22:24 UTC: spec portaldot-v3 3002, 21 assets, 11 collections, 9 pools, Nfts.Features 0. These are a dated snapshot, not fixed product values. The testnet genesis remains 0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd.

The existing swap at block 159687, extrinsic 1, was reverified with matching ExtrinsicSuccess in a finalized canonical block. It is 14,849 blocks behind this snapshot, demonstrating recovery beyond the former 24-block limit.

## Boundaries

No new transfer was signed during this update. Historical transaction evidence does not prove the new treasury form has completed a human wallet flow. Listing/buying remain disabled by the runtime Trading bit. There is no Portova backend indexer, custom contract, mainnet switch, vesting, auction or royalty implementation.

Validation details: [QA](submission/QA.md). Network evidence: [JSON](submission/network-evidence.json).
