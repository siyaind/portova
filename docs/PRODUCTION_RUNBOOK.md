# Production activation and operations

This release adds code and isolated database tests. It remains a testnet application. Production readiness requires the acceptance evidence below; installing Redis alone does not satisfy it.

## Configure isolated environments

Use separate databases, Redis instances, billing keys and webhook secrets for staging and production. Add credentials only through the hosting/provider configuration. Do not commit or paste secrets. Node.js 22+ is required.

- `DATABASE_URL` or `POSTGRES_URL`: Neon Postgres connection.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (integration `KV_REST_API_*` aliases work).
- `PORTOVA_ORIGIN`: exact HTTPS deployment origin (default production hostname).
- `RATE_LIMIT_SALT`: random private value for hashing trusted proxy client identifiers.
- `CRON_SECRET`: random private bearer secret for worker and operator health requests.
- Optional `INDEXER_START_BLOCK`: first finalized block to index. Default is the current finalized tip at first initialization. It does not claim earlier history. Use an archive-capable RPC for old blocks; do not skip unreadable blocks silently.

Run `npm run db:migrate` from a secure environment containing the database variable. It applies versioned, checksummed migrations under a database advisory lock, within transactions. Existing cloud-schema installations are compatible. Do not modify an already applied migration; add a new version. Use a restricted app database role with only Portova tables/functions, and a separate migration role. Provider account access requires MFA and least privilege.

GET `/api/projects/status` performs bounded database/schema and Redis checks. It does not disclose credentials. GET `/api/ops/health` requires `Authorization: Bearer <CRON_SECRET>` and includes RPC, finalized height, indexed range and lag. Configure an external monitor with its secret in that monitor's secret store. Alert on unavailable dependencies, request errors, worker failures, increasing index lag and subscription/webhook failures. Logs intentionally omit request bodies, wallet signatures and raw database errors.

## Enable workers

Deploy the Node worker `npm run ops:worker` on a long-running compute service, with `PORTOVA_ORIGIN` and `CRON_SECRET`. `node scripts/worker.mjs --once` is available for a scheduler. Do not place secrets in URLs or command arguments. No scheduled automation is created by this repository.

The worker invokes bounded POST `/api/ops/run?kind=indexer` jobs (up to 20 sequential finalized blocks or a 35-second indexing budget), and monitor jobs every fifth cycle. State is in Postgres. Concurrent indexers compare checkpoint and parent hashes atomically. A mismatch stops progress and requires investigation. Jobs never submit chain transactions.

History contains related native Assets/Nfts/AssetConversion/PoolAssets subjects, including supported utility batches. It is object association, not a revenue ledger. Extrinsic-level success does not prove every nested operation in a non-atomic batch succeeded. UI reports are explicitly bounded to the latest 100 matching events; audit pages load 50 at a time.

Monitoring samples up to five paid projects per job, maintaining a cursor. It compares issuer, token status, collection owner and pool reserve changes at finalized snapshots. Pool lookup is bounded to four discovery pages; missing or out-of-coverage objects produce a read-failure alert, retain prior facts and advance the cursor so one bad project does not block other teams. A reserve decline of at least 20% is an attention flag, not proof of a liquidity withdrawal or attack. Alerts are in-app, not automatic email/SMS. Confirm acceptable polling delay, project coverage, RPC load and catch-up rate under representative traffic. Increase worker capacity only after measurement. Runtime decoding changes must be reviewed before approving the new version.

## Billing in test mode first

Create USD monthly prices: Pro 4900 cents and Team 14900 cents. Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE`, `STRIPE_TEAM_PRICE`, and `PORTOVA_BILLING_ENABLED=true`. Configure the provider's hosted customer portal with subscription cancellation and invoice access. Set the webhook endpoint to `/api/billing/webhook` and subscribe to customer.subscription.created/updated/deleted. Test signatures, automatic retries, cancellation, expiry, payment failure and out-of-order events. Refunds remain operator/provider actions; the app does not issue refunds automatically.

Only test keys work until `BILLING_LIVE_APPROVED=true` is explicitly set with a live secret key. This flag is an operator gate, not legal approval. Complete legal/provider/tax review and the launch tests first. Server-side price validation rejects prices that differ from the published USD monthly amounts. Checkout creation uses a signed request and provider idempotency keys. A new subscription is blocked when an existing actionable subscription should be managed through Billing.

Events are signature-verified from the exact raw body. The server retrieves current provider subscription state, maps approved price IDs, and guards persisted state by provider event creation time. Monitor missing events; after a delivery outage, replay undelivered events from the provider dashboard before restoring access assumptions. Provider state reconciliation is required during incident recovery.

## Backups, support and incidents

Enable an appropriate provider point-in-time recovery window. Schedule `npm run db:backup` in a secure environment with official PostgreSQL client tools. Dumps go to `out/backups` by default (ignored by Git and deployment). Move backups to encrypted restricted storage, monitor failures and test restoration in staging. A backup command succeeding is not a restore drill. Recovery-point and recovery-time objectives must be agreed with the operator before offering an SLA.

Read the private support table using operator-only database access. `node scripts/support-reply.mjs <ticket-uuid> <reply-file>` saves an answer for the requesting wallet. Replies must contain no secrets. Moderation, identity disputes, deletion requests, legal retention and provider billing records require operator handling. Deleting a project does not remove public onchain history or already exported copies. Retain audit records only under the approved privacy/retention policy; review the audit/support tables before commercial activation.

If signing behavior is suspect: disable affected UI access at the hosting layer, preserve evidence, restore a known-good deployment, investigate, and communicate through approved channels. Deployment rollback does not roll back schema or chain transactions. Prefer additive migrations, preserve backups, and rehearse rollback in staging. Never ask users to sign again merely because a transaction response was lost; recover its receipt first.

## Required evidence before public real-value launch

1. Real-wallet matrix: rejection, account/network change, low balance, tiny pool deposit, duplicate NFT ID, LP add/remove, swap slippage, ambiguous outcomes and reload recovery.
2. Browser matrix: mobile, keyboard navigation, denied storage, concurrent tabs, nonce CSP hydration and supported wallet extensions.
3. Live integration tests: migrations, signed cloud replay/retry, roles, expired invitations, transfers, deletion, rate limits and unpublishing.
4. Indexing/monitoring: representative native and nested calls, duplicate workers, restart, unavailable history, runtime upgrade and alert timing.
5. Billing sandbox: successful and failed payments, price mismatch, provider retries, cancellation and portal/invoices.
6. Load/abuse testing, independent security review, restore and rollback drills, assigned incident/support owner.
7. Separate mainnet compatibility validation and legal approval. Mainnet is intentionally not enabled by these changes.
