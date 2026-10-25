# October 25 review follow-up

This records the code response to the supplied review. The user will perform real wallet testing. No new wallet approval or transfer was executed by the coding agent.

| Review item | Code response | Remaining validation |
|---|---|---|
| Treasury live proof | Kept the reviewed keep-alive flow; added original fee-estimate and actual-fee receipt fields | The owner must sign a small testnet withdrawal, compare balances/fees and exercise cancellation/account switching |
| Wallet context | Every signing screen uses useWalletOperation and guardedSignAndSend. An operation binds account, extension source, genesis, runtime, connection, mount lifetime and draft revision; checks run before signing and after any asynchronous predicate before broadcast. Swap also retains the displayed minimum instead of lowering it after a refreshed quote | Test with the chosen real extension; mock tests prove that changed contexts do not reach send |
| NFT recovery parity | /run and /nft-launchpad use the same local-storage checkpoint and state machine. Saved settings, assigned collection ID, create/finish hashes, inclusion hints and backward recovery cursors survive reload. The owner and missing first item are checked before and after a finishing signature | Interrupt after create, reject the finishing signature, reload and resume in the other route using the same owner |
| Discovery limits | Collection discovery enumerates storage-key pages rather than numeric IDs 0–99. Listings enumerate price-storage pages without first-20-collection or item-23 restrictions; the UI shows complete/partial coverage and loads further pages at a pinned snapshot | Larger future networks remain bounded per RPC page; an unavailable node is an error, not an empty result |
| Treasury meaning | Studio and Treasury identify a linked-account balance/withdrawal reference, explicitly excluding sale attribution, automated revenue routing and royalties | An auditable revenue-routing system remains a separate product design |
| Fee evidence | Preflight uses a policy reserve of max(4383 planck, 10% of the estimate) and refuses marginal remaining balance. Receipts save the original pre-sign estimate, reviewed budget, runtime and matching TransactionFeePaid outcome | A percentage reserve is not a proven maximum. More original wallet estimates, account states and runtime versions must be collected |
| NFT copy | Both routes explain two signatures and display the saved launch stage. The dedicated form has a two-step progress indicator | Real-wallet rehearsal remains user-owned |
| Creator intelligence | Creator Launch Health in Studio combines ownership, issuer authority, total supply, outside-issuer balance, paginated holders, reserves, LP shares, model swap impact and confirmed browser receipts | Circulating supply needs a defined exclusion policy. Model output excludes fees. Browser receipts are not complete project history |

## Evidence and checks

- Unit coverage includes account/source/genesis/runtime/draft/revision changes, late account switching, asynchronous quote checks, interrupted NFT state, safe retry after a proven pre-broadcast rejection, sparse IDs above 100, listings above item 23, stalled cursors, supply/LP arithmetic, fee scaling and receipt import trust boundaries.
- The optimized production build and TypeScript check pass. The final test run has 68 passing tests.
- The public testnet pagination check found all 11 collection keys across three four-entry pages at one finalized snapshot. The price map had zero entries and was reported complete. See submission/discovery-evidence.json.
- submission/fee-measurements.json reconstructs signed queryInfo at parent state for a transfer, a batch and a swap, using three accounts and runtime portaldot-v3:3002. These are comparisons with inclusion fee events, **not** originally recorded wallet paymentInfo quotes. The originalWalletEstimate fields remain null. Original pre-sign quotes are now captured prospectively in browser receipts.
- Reproduction: npm test; npm run typecheck; npm run build; node --experimental-strip-types scripts/verify-discovery.mjs; node scripts/measure-fees.mjs. Both evidence scripts are read-only.

## Focused owner rehearsal

1. Treasury: connect the linked account, review a small recipient transfer, reject once, then approve a fresh review and retain its finalized receipt and balance comparison.
2. Every signing flow: change account, extension permission, network or draft while a popup is open; the old signature must not broadcast. Return to the original account and make a fresh review.
3. NFT: create once, reject the second signature, reload, move between /run and /nft-launchpad, and finish the saved collection. Another account must not inherit that checkpoint. An existing first item must prevent duplicate finishing.
4. Fees: export the receipt backup after finality and compare estimatedFee, feeBudget, actualFee, runtimeVersion and the matching explorer receipt. Missing fee events stay unknown.
5. Health: refresh the finalized snapshot, change the scenario amount, inspect holder coverage and confirm the linked account's LP share. Do not describe outside-issuer supply as verified circulation or browser receipts as project revenue.
