# Manual QA follow-up — November 5, 2026

The owner completed the live V3 testnet acceptance run. Successful token, NFT, treasury, pool, liquidity and two-way swap operations were checked against finalized chain state. Workspace private/public access, viewer/editor permissions, revocation, revision conflicts, project quota, workspace transfer and deletion were also exercised. These are owner-reported results, separate from automated tests.

The published example links asset 644897333, collection 24 and pool LP 17. The owner left it public at revision 10. The coding agent made no wallet signatures and did not edit that cloud record during the follow-up.

## Corrections

- Receipt backups retain a stable source identity for hashless attempts. Repeated imports, including re-export/import, do not create new cancelled entries. Imported results still require chain verification. Existing legacy copies with different identities are retained rather than guessed away.
- Terminal wallet callbacks resolve inclusion height from the receipt's block hash. A bounded background lookup fills missing heights on saved receipts when the node can return their headers. Failed lookups remain unknown; the current head is never substituted.
- Pool creation includes both the setup charge and reserved account deposits in its preflight budget and review. The owner's pool creation at block 323598 was independently inspected: 1 tPOT setup charge, two 1 tPOT reservations, and 0.01160697254661 tPOT network fee. The 3.01160697254661 reduction in free balance was not all a fee. For two non-native assets, each asset account plus the LP account is budgeted.
- Swap requests pool/asset discovery on entry, coalesces concurrent discovery, retries a failed initial scan once, and offers explicit refresh. Missing discovery has loading/error feedback. Invalid amounts distinguish precision, format and zero; token-mint errors clear when inputs change.
- Swap and liquidity cost reviews use a viewport-centered, focus-trapped dialog with countdown and automatic expiry. The swap review keeps the actual signed minimum, and success feedback includes its hash and inclusion block where available.
- Treasury reviews expire automatically while awaiting confirmation and explain invalidation when details change. Post-signature guards remain in place.
- Explicit wallet disconnection records the tab-local disconnected state and prevents old account subscriptions from repopulating it. Disconnected workspace actions explain connection rather than silently changing state.
- Support acknowledgement appears next to the support form with its ticket ID. Authorization denial clears the stale dashboard.
- Public projects link to the specific LP pool and explain missing evidence for the current revision. Public fetches have a timeout and retry action. Editing a profile intentionally invalidates older role evidence; the owner must refresh it using a signed request. Unreviewed does not imply operator review or network endorsement.
- Mobile landing navigation includes plans and the external bridge. The app drawer isolates its underlying content and has an opaque surface so the search icon cannot bleed over the logo.

## Verification and boundaries

Local tests cover repeated hashless receipt import, signed receipt inclusion heights, precision feedback and pool reserve budgeting. Browser checks exercised direct swap reload and real discovery, zero/precision feedback, mobile links/drawer layering, and the actual review component's viewport bounds and automatic expiry in a temporary local harness. The harness was removed before production build. Browser proof screenshots stay in ignored local evidence storage.

Worker workflow 41919208516 completed successfully: indexer height 279495, monitor checked three projects at block 325864, and payments checked/credited zero. The owner subsequently confirmed both reserve-drop alerts at that block, including PQA 10000000000 → 7428374836 and tPOT 500000000000000 → 378649643839899, and the post-withdrawal export. R8 monitoring is now an owner-reported pass. Historical indexing remains substantially behind and schedules remain best effort.

## Focused retest corrections

The owner's 04:30–04:46 IST retest passed direct swap discovery, validation wording, receipt block numbers, withdrawal review expiry/cancellation, support acknowledgement, public LP links and refreshed role evidence at block 326689. Revision 10 was unchanged. Four remaining defects and a transient loading message were corrected:

- Swap now checks finalized spendable native balance, the network fee reserve, and token balance/minimum remainder before enabling a connected wallet's Swap button. An unavailable check fails closed. The existing fresh review before signing remains required.
- Receipt identity treats the original V3-only store's missing genesis as the V3 genesis for matching. Explicit other networks stay separate. Imports run under the receipt storage lock and report the number actually committed. Proven duplicate aliases converge; unrelated attempts are retained. Imported outcomes still require chain verification.
- Workspace connection feedback survives the selected-account reset and explicitly asks the user to load workspaces after connecting. Connection alone does not sign a storage request.
- The mobile app drawer is rendered at the document body with an opaque, isolated surface; the underlying header is hidden while it is open. Initial liquidity discovery now reports loading until discovery actually fails.

All 142 automated tests passed, including the exact legacy case of 18 hashed and six hashless networkless records, repeated import, distinct-network separation, storage failure, and an unaffordable 99999999 tPOT preflight. In an isolated local browser, importing those 24 synthetic legacy records plus one new receipt produced 25 total and “Imported 1”; repeating produced 25 and “Imported 0”. At 390 × 844, the liquidity drawer logo was unobstructed. Synthetic receipts and the temporary fixture page were removed afterward. These checks do not substitute for the owner's focused live retest of the four corrections.

The owner subsequently passed receipt import (81 records remained 81 across old and fresh backup imports), workspace reconnect feedback, and the 390px liquidity/swap drawers. Oversized native and PQA inputs were blocked, while 0.01 tPOT enabled Swap after the funding check. The remaining defect was missing feedback when the node returned no quote. The balance/fee check and its visible status are now independent of quote availability. An unquoted call uses a one-base-unit output minimum only for fee estimation; that call is never signed or submitted. A real quote and a separate fresh preflight remain mandatory before signing. Native shortfalls explicitly say “Insufficient balance”; token shortfalls give a smaller-amount instruction. The final owner retest only needs to confirm these messages for 99999999 tPOT, 400 tPOT and 99999999 PQA, and their clearance on an affordable input. No transaction signature is required.

The follow-up retained 142 passing tests and passed the production build. A read-only V3 node check using A's public address and the unquoted fee-estimation call returned the native shortfall message for both 99999999 and 400 tPOT, the token shortfall for 99999999 PQA, and a successful funding check for 0.01 tPOT. No wallet connection, signature or submission was used for this check. The remaining human acceptance check is the visible feedback on the live page.

NFT trading was runtime-disabled during the owner's test. Public minting, the exact collaborator-count boundary, and the profile review-request flow were not manually run. Automated checks do not turn these into human acceptance passes. A testnet pilot demo must retain these limits; reliable scheduling/backfill and operational backup/restore remain separate production work.

An extension may retain the URL at which the site was first authorized (the owner saw `/liquidity` during a swap). The application does not control the extension's origin label. The network, signer, reviewed call and decoded transaction determine the operation; no origin-label change is claimed in this patch.
