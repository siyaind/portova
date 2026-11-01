# Security model

Updated October 24, 2026. This is an implementation description, not an audit.

October 25 follow-up: every signing route now shares a context guard for account, extension source, genesis, runtime, connection, mount lifetime and draft revision. The guard is checked before signing and after asynchronous validation before broadcast. Swap retains the minimum shown for review instead of silently lowering it after a fresh quote. Both NFT routes share durable launch checkpoints, ownership/item checks and safe retry after a proven pre-broadcast rejection. Invalid checkpoints block new creation until explicitly cleared.

Preflight now reserves max(4383 planck, 10% of the estimate) and refuses marginal remaining headroom. This is a policy, not an empirical fee maximum. Original estimates and matching charged-fee events are saved prospectively. Imported account/charged-fee claims are cleared until RPC verification. See REVIEW_FOLLOWUP.md for measured evidence and the user-owned live-wallet tests.

## Authority and network

The user's injected wallet holds the key. Portova never requests a seed or private key. ChainProvider verifies the expected testnet genesis and runtime name before marking the connection live. The rollout does not silently switch users to mainnet. EVM addresses and native Substrate accounts remain distinct.

Treasury permits only the linked proceeds authority to review a withdrawal. Canonical public-key comparison handles alternate SS58 encodings, while recipients must be valid prefix-42 addresses. The transfer keeps the sender alive. It cannot withdraw somebody else's funds or bypass chain permissions.

## Review and broadcast

Amounts use integer arithmetic and strict decimal/u128 parsing. Preflight reads finalized account state, frozen funds, existential deposit, deposits and guarded fees. Unknown or insufficient values stop before the wallet. Guards reduce avoidable failures; runtime dispatch can still fail.

Treasury requires a separate confirmation after review, with a 60-second limit. Network, sender, extension, project proceeds account, recipient and amount are checked across asynchronous wallet access. The exact reviewed call is signed, revalidated and then broadcast. Permission changes revoke the active selection. Disconnect invalidates late connection results. Double submission is blocked while an action is pending.

Swaps check a fresh runtime quote against the reviewed minimum, with a quote expiry. NFT Trading remains disabled unless the runtime explicitly enables it. Issuer and collection permissions remain runtime authorities, not frontend promises.

## Receipt evidence

Inclusion is not finality. A finalized label requires successful dispatch for this extrinsic index and canonical finality. Another extrinsic's success cannot confirm it. Unknown/no-hash outcomes remain Unknown and must be checked before retrying. Late callbacks cannot demote confirmed receipts.

Recovery saves inclusion hints and bounded search checkpoints. RPC calls have time bounds. Pruned history is unverified. Imported JSON is size/schema/network checked, rendered as plain React text, and cannot confer successful status without rechecking the chain. Explorer paths accept validated identifiers only.

## Storage and operational limits

Projects and receipts are browser-local, not encrypted custody or a server archive. Export backups before clearing site data. Storage failure is surfaced with an export link. Portova operates no indexer, faucet or bridge. Public RPC availability and testnet administration remain external dependencies.

Automated wallet tests use fake adapters and execute the actual submission helper. Read-only evidence capture queries the public chain. No human extension signature or new treasury transfer was executed in this update. See [QA](submission/QA.md) for the remaining manual checks.


## October 28 cloud boundary

Optional project storage now adds server routes, Postgres and Redis. Each private read/write uses a single-use wallet message challenge; cloud updates compare owner and revision. Public access is opt-in and revoked by an authenticated unpublished save. Server secrets never use NEXT_PUBLIC variables. Shared caching applies only to finalized discovery; signing reads remain direct. See [CLOUD_PROJECTS.md](CLOUD_PROJECTS.md) for provisioning, limitations and acceptance checks.


## November 1 production foundations

Cloud commands execute under one PostgreSQL transaction with retained idempotent results. Signatures are verified on every delivery, including retries. Accepted invitations, viewer/editor permissions, owner-only publishing/access changes and a two-party workspace transfer are enforced in the database. A canceled Team plan makes existing editors read-only. This does not grant chain authority. Project creation quotas are checked under an account advisory lock.

Public reads and signing endpoints have client/account/global rate controls; client identifiers use the hosting provider's trusted forwarded header and a salted digest. Public data is not cached beyond revocation. Stripe is removed. Optional crypto billing verifies an invoice-bound EVM wallet proof and the exact canonical finalized Base USDC transfer. Transaction hashes are unique across invoices, credits are atomic/idempotent, and prepaid terms do not overlap. Payer hashes are reserved only after transfer details are verified. No allowances or merchant private keys are used. Checkout remains behind an explicit operator flag.

Document rendering is dynamic with per-request CSP nonces; production inline-script permission is removed. The reviewed runtime baseline is Portaldot V3 testnet spec 3002, observed November 1. Unreviewed versions pause signing and worker ingestion. Operator health and worker routes require a private bearer secret; workers never sign or broadcast transactions.

Isolated PostgreSQL tests cover permissions, quota enforcement, authorization rollback, replay results, revision conflicts and indexer/monitor checkpoint consistency. They do not substitute for a human wallet matrix, deployed-provider tests, an independent audit, load tests or restore drills. See PRODUCTION_RUNBOOK.md.
