# Production activation and operations

Portova's hosted pilot uses Neon Postgres, Upstash Redis and a scheduled indexer/monitor worker. It remains a testnet application. Recorded acceptance is in [QA](submission/QA.md); the additional gates below apply before a real-value production launch.

## Configure isolated environments

Use separate databases, Redis instances and operator/payment configuration for staging and production. Add credentials only through the hosting/provider configuration. Do not commit or paste secrets. Node.js 22+ is required.

- `DATABASE_URL` or `POSTGRES_URL`: Neon Postgres connection.
- `DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING`: direct connection for the migration runner and its session lock. Marketplace integrations normally supply this alongside the pooled application URL.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (integration `KV_REST_API_*` aliases work).
- `PORTOVA_ORIGIN`: exact HTTPS deployment origin (default production hostname).
- `RATE_LIMIT_SALT`: random private value for hashing trusted proxy client identifiers.
- `CRON_SECRET`: random private bearer secret for worker and operator health requests.
- Optional `INDEXER_START_BLOCK`: first finalized block to index. Default is the current finalized tip at first initialization. It does not claim earlier history. Use an archive-capable RPC for old blocks; do not skip unreadable blocks silently.

Run `npm run db:migrate` from a secure environment containing the database variable. It applies versioned, checksummed migrations under a database advisory lock, within transactions. Existing cloud-schema installations are compatible. Do not modify an already applied migration; add a new version. Use a restricted app database role with only Portova tables/functions, and a separate migration role. Provider account access requires MFA and least privilege.

GET `/api/projects/status` performs bounded database/schema and Redis checks. It does not disclose credentials. GET `/api/ops/health` requires `Authorization: Bearer <CRON_SECRET>` and includes RPC, finalized height, indexed range and lag. Configure an external monitor with its secret in that monitor's secret store. Alert on unavailable dependencies, request errors, worker failures, increasing index lag and payment-reconciliation failures. Logs intentionally omit request bodies, wallet signatures and raw database errors.

## Enable workers

The existing GitHub workflow is described below. For continuous operation, deploy `npm run ops:worker` on a long-running compute service with `PORTOVA_ORIGIN` and `CRON_SECRET`. `node scripts/worker.mjs --once` is available for another scheduler. Do not place secrets in URLs or command arguments.

The worker invokes bounded POST `/api/ops/run?kind=indexer` jobs (up to 20 sequential finalized blocks or a 35-second indexing budget), and monitor jobs every fifth cycle. State is in Postgres. Concurrent indexers compare checkpoint and parent hashes atomically. A mismatch stops progress and requires investigation. Jobs never submit chain transactions.

History contains related native Assets/Nfts/AssetConversion/PoolAssets subjects, including supported utility batches. It is object association, not a revenue ledger. Extrinsic-level success does not prove every nested operation in a non-atomic batch succeeded. UI reports are explicitly bounded to the latest 100 matching events; audit pages load 50 at a time.

Monitoring samples up to five paid projects per job, maintaining a cursor. It compares issuer, token status, collection owner and pool reserve changes at finalized snapshots. Pool lookup is bounded to four discovery pages; missing or out-of-coverage objects produce a read-failure alert, retain prior facts and advance the cursor so one bad project does not block other teams. A reserve decline of at least 20% is an attention flag, not proof of a liquidity withdrawal or attack. Alerts are in-app, not automatic email/SMS. Confirm acceptable polling delay, project coverage, RPC load and catch-up rate under representative traffic. Increase worker capacity only after measurement. Runtime decoding changes must be reviewed before approving the new version.

## Crypto payments and scheduled worker

Optional prepaid terms use native USDC on Base chain 8453, contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Checkout is currently disabled by `CHECKOUT_RELEASE_ENABLED=false` in `lib/plans.ts`. Setting an environment flag alone does not override that release policy. A future approved activation must pass the payment acceptance/commercial gates, deliberately change the release policy, set `CRYPTO_PAYMENTS_ENABLED=true`, and configure the public `CRYPTO_PAYMENT_RECIPIENT`. `BASE_PAYMENT_RPC_URL` optionally supplies a trusted Base RPC (default public mainnet.base.org). No merchant private key is needed or stored.

The buyer creates an invoice with their Substrate workspace identity, authorizes invoice credit using their EVM payment wallet, and explicitly approves a direct USDC transfer. There are no allowances or automated debits. Proof binds the site, invoice, workspace account, amount, recipient and Base network. The backend verifies the exact USDC Transfer event, payer, recipient, amount, canonical receipt, timestamp window and finalized height. A transaction can credit only one invoice. Identical retries cannot extend access twice. Each credited payment adds a nonoverlapping 30-day term after existing paid time. Entitlements are calculated in the database, including scheduled plan changes and expiry. Prices remain experimental and checkout can remain disabled while customer value is validated.

Invoices expire after one hour; timely transfers can be recovered for seven days after expiry. Over/underpayment, wrong chain/token, late transfers, disputes and refunds require operator support. An open wallet transfer cannot be canceled by leaving Portova; the customer must dismiss it in the wallet. Base finality may take around 20 minutes or longer. A pending hash is never a reason to pay twice.

The GitHub workflow `.github/workflows/worker.yml` runs on a best-effort five-minute schedule, with manual dispatch available. `PORTOVA_CRON_SECRET` in repository Actions secrets must equal Vercel Production `CRON_SECRET`. It runs bounded indexer catch-up, project monitoring and pending-payment reconciliation. Schedules can be delayed or disabled by the provider. Monitor job activity and lag; use a dedicated continuous worker before offering an SLA. The persistent `scripts/worker.mjs` supports that upgrade.

Before enabling payments, run receipt/proof/replay tests and human wallet acceptance, including finality delay, a lost response, invoice expiry, queued terms, wrong token/chain/payer/amount, and operator refund recovery. Never run payment tests by moving customer funds automatically.

## Backups, support and incidents

Enable an appropriate provider point-in-time recovery window. Schedule `npm run db:backup` in a secure environment with official PostgreSQL client tools. Dumps go to `out/backups` by default (ignored by Git and deployment). Move backups to encrypted restricted storage, monitor failures and test restoration in staging. A backup command succeeding is not a restore drill. Recovery-point and recovery-time objectives must be agreed with the operator before offering an SLA.

Read the private support table using operator-only database access. `node scripts/support-reply.mjs <ticket-uuid> <reply-file>` saves an answer for the requesting wallet. Replies must contain no secrets. Moderation, identity disputes, deletion requests, legal retention and provider billing records require operator handling. Deleting a project does not remove public onchain history or already exported copies. Retain audit records only under the approved privacy/retention policy; review the audit/support tables before commercial activation.

If signing behavior is suspect: disable affected UI access at the hosting layer, preserve evidence, restore a known-good deployment, investigate, and communicate through approved channels. Deployment rollback does not roll back schema or chain transactions. Prefer additive migrations, preserve backups, and rehearse rollback in staging. Never ask users to sign again merely because a transaction response was lost; recover its receipt first.

## Required evidence before public real-value launch

1. Real-wallet matrix: rejection, account/network change, low balance, tiny pool deposit, duplicate NFT ID, LP add/remove, swap slippage, ambiguous outcomes and reload recovery.
2. Browser matrix: mobile, keyboard navigation, denied storage, concurrent tabs, nonce CSP hydration and supported wallet extensions.
3. Live integration tests: migrations, signed cloud replay/retry, roles, expired invitations, transfers, deletion, rate limits and unpublishing.
4. Indexing/monitoring: representative native and nested calls, duplicate workers, restart, unavailable history, runtime upgrade and alert timing.
5. Crypto billing: exact transfer proofs, failed payments, finality, retries, queued terms and manual refund handling.
6. Load/abuse testing, independent security review, restore and rollback drills, assigned incident/support owner.
7. Separate mainnet compatibility validation and legal approval. Mainnet is intentionally not enabled by these changes.
