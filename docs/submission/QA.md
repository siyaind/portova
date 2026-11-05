# Validation record

## November 5 final acceptance checkpoint

This section supersedes the pending wallet-test language in the historical October entries below. The owner ran the live V3 testnet wallet/workspace rehearsals and reported the R1–R12 results and focused corrections. The detailed follow-up and remaining scope are in [the November 5 record](../qa-followup-2026-11-05.md).

- Receipt backup import: passed across the earlier 81-record backup and a fresh export, with zero added receipts and a stable count of 81.
- Explicit disconnect/reload and workspace reconnect feedback: passed.
- Mobile liquidity and swap drawers at 390px: passed.
- R8 monitoring: both reserve-drop alerts at block 325864 and the post-withdrawal report passed owner review.
- Final swap feedback: 99999999 tPOT and 400 tPOT show the explicit native-balance refusal; 99999999 PQA shows the token-balance refusal. All remain disabled. On 0.01 tPOT the error clears and Swap enables after a quote and funding check. No wallet opened and nothing was signed during this retest.
- The final acceptance release `790512c` passed 142 automated tests, type checking, production build and CI. The public example remained cloud Revision 10.

The subsequently reported `/swap?pool=17` selection issue is a separate navigation correction: explicit LP requests must select that pool after discovery and must not fall back to an unrelated pair while it loads. It does not invalidate the completed balance tests. Browser verification of that correction is recorded with its release.

Public minting, the exact collaborator-count boundary and the profile review-request flow do not gain manual passes from these results. NFT trading was runtime-disabled. These limits and best-effort worker/indexing behavior must remain visible in any submission claims. Passing tests and a testnet rehearsal are not a security audit or a mainnet production certification.

## October 25 code follow-up

68 tests and the TypeScript/production-build checks pass for the shared wallet guards, staged NFT recovery, paginated discovery, fee measurements and Creator Launch Health. A read-only RPC check matched all 11 collections across three storage pages; a parent-state fee reconstruction covered three call classes and three accounts on runtime 3002. These historical reconstructions are not original wallet quotes. See ../REVIEW_FOLLOWUP.md and the discovery/fee JSON evidence in this directory.

The user explicitly chose to perform real-wallet testing themselves. No new connection permission or transaction was approved by the coding agent. The manual steps below remain unexecuted until the owner records their results.

October 24 baseline follows. Tests and read-only chain checks are separate from a real wallet signing session.

## Automated checks

54 unit tests passed after adding withdrawal, wallet orchestration, receipt storage and recovery coverage. TypeScript passed at that checkpoint. Production build and final browser checks are recorded in DEPLOYMENT.md after deployment.

Coverage includes wallet rejection; a changed account/review preventing send after signature; matching extrinsic-index dispatch evidence; ignoring late callbacks; wrong proceeds authority; invalid destination; precision/u128 limits; changes to extension/network/recipient/amount; permissions resolving after a draft changed; insufficient funds; frozen funds and keep-alive spendable balance; old inclusion-block lookup; bounded paginated search; disabled author RPC; pruned events; noncanonical block hints; reloads beyond 40 receipts; backup network validation; imported success claims reset for verification.

Fake adapters exercise the actual signAndSend and guardedWallet helpers. They do not certify behavior in every third-party extension.

## Public RPC check

The old swap at block 159687 was recovered as finalized with matching success evidence, while the finalized head was 174536. See network-evidence.json. No new transaction was signed or broadcast by the verification script.

## Local production-browser checks

The optimized production build served on 127.0.0.1:3000. The old swap was recovered through Activity as Finalized at block 159687, extrinsic 1, then survived reload. Export generated JSON; importing it preserved the verified existing receipt without duplication. Studio saved a local demo project linking public testnet objects; Treasury read its proceeds balance and showed withdrawal/review controls. Swap returned a real runtime quote and minimum output. Screenshots were captured for the 60-second walkthrough.

Desktop content had no horizontal overflow at 1275px. A requested 390px viewport override did not apply (DOM width remained 1275px), so mobile verification is not claimed. Browser native input timed out; DOM-based controls completed the checks. No human wallet was connected or signed through the browser.

## October 24 production verification

Vercel deployment dpl_7av1mpCeeDfQQTpWHVmCSZiNf7La completed with READY state and https://portova.vercel.app assigned. Its compilation and TypeScript checks passed. HTTP checks of /, /treasury, /activity, /swap, /settings and /demo/index.html returned 200 and found the updated content. The walkthrough MP4 returned 200 with video/mp4 and the expected 471518-byte length. The live landing page was inspected in the browser. Deployment evidence is recorded in DEPLOYMENT.md.

## Human wallet rehearsal before recording a new transfer

1. Use a funded testnet proceeds account. Connect, deny permissions once, then reconnect and choose the account.
2. Link it in Studio. A different selected account must not authorize its withdrawal.
3. Review a small prefix-42 recipient transfer. Compare exact recipient, amount and fee budget with the wallet.
4. Reject in the wallet: no success claim. Check the wallet/node before retrying any no-hash outcome.
5. Review again, then switch account or revoke permission: the review must invalidate and the old call must not broadcast.
6. Try more than spendable: stop before signing; keep frozen funds and existential deposit intact.
7. Have the owner sign a small transfer. Save the real hash, wait for matching successful dispatch/finality, confirm recipient balance, reload and inspect the receipt in the explorer.
8. Export/import a receipt backup; imported success is reverified.

Steps requiring a human extension and a fresh transfer remain unexecuted in this update. Do not label them completed or present a historical swap as treasury evidence.
