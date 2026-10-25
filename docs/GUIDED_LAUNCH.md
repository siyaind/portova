# Guided launch and reliability follow-up

Implemented October 25, 2026. Entry point: `/launch`.

## Creator journey

1. Save a project name and choose a creator token or an NFT collection. Token launches can include optional liquidity setup. This writes only a browser-local plan.
2. Connect an injected Substrate wallet when ready. Network readiness and a timestamped finalized spendable-balance read are shown. The official participant-funding instructions are linked; Portova does not operate a faucet.
3. Review the existing token or NFT form, including permissions, destination, fees and reserved deposits. Guided form drafts persist. NFT creation remains two explicit signatures with the shared durable checkpoint.
4. A successful finalized creation attaches its object ID to the originating project. A changed project/account or an existing conflicting link prevents attachment; the transaction receipt remains available for manual inspection. Imported receipt claims cannot attach project objects.
5. Optionally create/link the token's native pool and add liquidity. Pool setup and deposit remain separate signatures. An empty pool is not described as usable liquidity. Existing pool links can be selected explicitly.
6. Review Creator Launch Health and continue into Studio or Activity. Health reads actual finalized objects; saved IDs alone do not establish ownership, liquidity or launch readiness.

This release retains one local project. It does not introduce hosted accounts, multi-project management, public project pages, media uploads/pinning, an indexer or automated sales routing.

## Technical fixes

- Account reads pin native balances, token balances and positive-holding metadata to one finalized block. Failed asset reads carry explicit IDs and a partial-coverage warning. An incomplete empty result never says that the account has no holdings.
- Portfolio and linked-account views refresh every 30 seconds, after settled account transactions, on discovery changes and through existing/manual refresh controls. They show snapshot timestamps/blocks; these are snapshots rather than continuously subscribed balances.
- The chain becomes ready after network identity and head subscription. Asset, collection and pool discovery run independently in pages, expose completeness/errors and can be retried. Assets are enumerated from asset keys, including assets without metadata names. Pool details and account reads use bounded RPC concurrency. Counts are published only for complete discovery.
- NFT create/finish/clear/recovery operations coordinate through native Web Locks scoped by network and wallet. Checkpoints synchronize across tabs and screens; signing checks the persisted checkpoint again before broadcast. Browsers without Web Locks fail closed for these operations. Locks coordinate this origin's current application tabs, not another device or an older independently hosted build.
- Receipts merge under a storage lock and synchronize across tabs. Versioned merges preserve unrelated records and do not demote terminal outcomes. Project writes use a lock and revision checks so stale drafts cannot overwrite a newer record. Storage read/write/remove failures are surfaced.
- Wallet dialogs contain keyboard focus, restore it on close, handle Escape and preserve focus across network-head renders. The unused EVM connection controls are placed under an advanced disclosure.
- Production responses add CSP, framing restrictions, nosniff, referrer and permissions policies. The CSP permits the configured testnet RPCs, local assets and WebAssembly; static Next.js inline scripts/styles remain allowed. This is defense in depth, not an application security audit.

## Validation

84 automated tests cover bounded concurrency, pinned/partial account reads, sparse asset discovery, competing launch leases, receipt merging and import trust boundaries, project storage failures, stale revisions, and the previous wallet/fee/recovery behavior.

The optimized production build and TypeScript checks pass. Browser checks verified token/NFT plan branches, token-field and NFT-URI draft restoration, cross-tab plan synchronization, rejection of a stale Studio edit, linked-account snapshot labels, the optional pool view and wallet-dialog focus containment/restoration with the advanced controls both closed and open. Measured phone-width checks for Launch, NFT Launchpad, Portfolio, Studio and Swap used a 390-pixel viewport (386-pixel document client/scroll width), with no page-wide horizontal overflow. One local isolated preview permits same-origin test framing; deployed responses retain DENY and frame-ancestors none.

Real extension permission, signing, treasury transfer, NFT interruption and liquidity rehearsals remain the owner's acceptance tests. No agent wallet approval or transaction is part of this release. Deployment and GitHub CI outcomes are reported in the release handoff.

Two local tabs also recovered different existing public transactions (blocks 154574 and 159687). Both tabs retained both finalized receipts with the actual signer and matching charged-fee event. This exercised live cross-tab receipt synchronization without broadcasting a new transaction. A final guard disables pool creation when discovery already identifies the selected pair; ordinary runtime races can still change state before inclusion.

## Owner wallet acceptance

1. Token guide: save a plan, connect your account, fill the token details and inspect the fee/deposit review. Reject once, then submit a fresh review. After successful finality, verify that the exact token ID is linked to the same project and its receipt survives reload.
2. NFT guide: create the collection, reject the finishing signature, reload and resume the same checkpoint. Try the other NFT route and a second tab; an active launch lock must prevent a competing signature. Finish once and verify the assigned collection ID and first item.
3. Optional liquidity: review the native pool setup fee, create or link the correct pair, then separately review a small deposit. Check that Launch Health shows actual reserves and your LP share. Entering this step alone does not fund a pool.
4. Switch account or change the project/draft while a signature is open. A stale signature must not reach broadcast. A transaction already broadcast keeps its receipt and must be checked before retrying.
5. Check Portfolio and the linked-account balance after a settled success and a fee-paying failure. Verify the displayed finalized block, fee and balance. Use refresh for an external transfer; the normal polling interval is 30 seconds.
6. Repeat with your actual phone/wallet environment. Desktop and phone-width rendering checks do not establish mobile extension compatibility.
