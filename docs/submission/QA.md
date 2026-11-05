# Validation record

Updated November 5, 2026. Automated checks, read-only verification and human wallet acceptance are separate evidence sources. The testnet rehearsal does not constitute an independent security audit or mainnet certification.

## Automated and deployment checks

The November 5 acceptance release passed all 142 tests, type checking, production build, GitHub CI and Vercel deployment. Coverage includes actual wallet submission orchestration through fake adapters, amount/fee guards, finalized receipt matching, NFT recovery, browser storage coordination and isolated PostgreSQL authorization/mutations.

Tests cover origin/account/source/genesis/runtime/draft changes; rejected/ambiguous outcomes; late callbacks; wrong extrinsic events; permission/quota/revision conflicts; atomic replay results; receipt import deduplication; fee budgeting; paginated discovery; and indexer/monitor checkpoint consistency. Fake adapters do not certify every wallet extension.

## Human testnet acceptance

The project owner completed the live V3 wallet/workspace rehearsal and reported the R1–R12 results and focused corrections. The published example remained cloud Revision 10, linking asset 644897333, collection 24 and LP 17.

| Area | Recorded acceptance |
|---|---|
| Wallet | Account identity, finalized balances, disconnect/reconnect, refresh and rejected signatures |
| Native transactions | Token creation/metadata/supply, NFT create/finish, treasury, pool creation, liquidity add/remove and two-way swaps checked against finalized state |
| Projects | Private save/load, local draft persistence, existing-object import, public publication/unpublication and example filtering |
| Collaboration | Accepted viewer/editor roles, owner-only restrictions, editor content save, denied publication change and revocation from already-open tabs |
| Workspace lifecycle | Revision conflicts, owned-project quota, transfer and deletion exercised in the reported rehearsal |
| Receipt backups | Earlier 81-record backup and a fresh export repeatedly imported with zero additions; count stayed 81 |
| Swap balance feedback | 99999999/400 tPOT show native shortfalls; 99999999 PQA shows token shortfall. Swap stays disabled; 0.01 tPOT clears the error and enables after quote/funding check |
| Support/mobile | Ticket acknowledgement and clear 390px liquidity/swap drawers |
| Monitoring | Both reserve-drop alerts at block 325864 and the post-withdrawal export verified |

The last message-only swap retest opened no wallet and signed nothing. Role evidence was refreshed at finalized block 326689 for the public Revision 10 snapshot. Evidence is time/revision bound, not an endorsement.

## Browser and read-only checks

- Direct Swap reload discovers pools; validation errors clear when the amount changes.
- Review dialogs are centered, focus-contained and expire/cancel without opening a wallet.
- The optimized local build selects LP 17 from `/swap?pool=17`, allows manual selection and restores LP 17 on refresh. A missing requested LP shows a notice and disables transaction controls. The deployed LP 17 link was verified as tPOT/PQA.
- An isolated synthetic legacy store with 18 hashed and six hashless rows imported one genuinely new receipt as “Imported 1”; repeating returned “Imported 0”. Fixture pages/data were removed afterward.
- Read-only V3 checks using the public funded account returned the same native/token shortfalls and passed funding for 0.01 tPOT. No signature/submission was used.
- Historical public receipt recovery and cross-tab merging were independently exercised. Original captured data is in [integration evidence](EVIDENCE.md).

## Remaining limits

Public minting, the exact collaborator-count boundary and the profile review-request flow do not have human acceptance passes in this record. NFT trading was runtime-disabled. Mobile-width rendering is not proof of compatibility with every mobile wallet.

Historical indexing remains behind and worker schedules are best effort. Real-value production still requires representative load/abuse tests, independent review, backup restore/rollback drills, reliable monitoring targets and separate network/commercial approval. Checkout remains disabled and bridging external.
