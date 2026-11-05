# Cloud projects

Cloud workspaces use Neon Postgres for project records and Upstash Redis for rate limits and shared discovery. The hosted Production integrations are configured; other environments need their own setup.

## Configuration

- `DATABASE_URL` or `POSTGRES_URL`: application database connection.
- `DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING`: direct migration connection where supplied by the integration.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or integration aliases `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
- `PORTOVA_ORIGIN`: exact deployment origin, default `https://portova.vercel.app`.
- `RATE_LIMIT_SALT`: private random value for rate-limit identifiers.

Keep credentials in local/hosting environment configuration. Use separate staging/Preview storage. Run `npm run db:migrate` from a secure environment to apply the full checksummed migration set. GET `/api/projects/status` checks database/schema and Redis availability. Worker and operator configuration is in the [runbook](PRODUCTION_RUNBOOK.md).

## Signed commands and revisions

Saving locally does not publish or upload a project. Cloud commands require an explicit Substrate message signature. Challenges expire after five minutes and bind origin, account, action, normalized payload hash and nonce. The database consumes authorization and changes records atomically. Repeating the same verified request returns its retained result for up to 24 hours; changing its signed payload does not authorize another action.

Updates require the expected cloud revision. Competing writes return a conflict; load the newer record before retrying. A device must load cloud projects before its first save to avoid overwriting an existing project from an incomplete local draft.

Cloud records contain project details, linked object IDs, publication and workspace metadata. Receipts and NFT recovery checkpoints are separate browser records; export receipts before clearing site data.

## Workspace access

Owners control publication, invitations, revocation, transfer and deletion. Invitations require acceptance; changed roles require renewed acceptance. Accepted viewers can read permitted workspace data. Eligible editors can save project content but cannot change publication or owner-only access settings. Revocation is enforced on subsequent server requests, including from already-open tabs.

Workspace transfer requires both parties and clears collaborators on acceptance. These permissions affect cloud records only. They cannot mint, withdraw or transfer assets without the runtime-authorized wallet's transaction signature.

## Public profiles and moderation

Public profiles are opt-in. Unpublishing prevents future public reads; downloaded copies and on-chain history cannot be recalled. Discover excludes private, hidden and incomplete profiles and excludes examples by default.

Publishing confirms the publisher wallet, not all claims in its description. Role evidence comes from a dated finalized block and matches the current project revision/network. Operator review is a separate status; content edits and ownership transfers invalidate approval. Owners may request review. Operators inspect the public page/evidence and use `scripts/review-project.mjs` with credentials supplied through the environment. Review decisions are audited; republishing cannot bypass a moderation hide.

## Cache and failure behavior

Redis caches finalized discovery by genesis, object type, block and cursor. Head pointers expire after 15 seconds and pages after 60 seconds. Discovery can fall back to browser RPC. Balances, permissions and signing preflight are read directly from the chain.

Cloud mutations and rate-limited public endpoints fail closed when required storage/rate limiting is unavailable. `/api/projects/status` reports availability without credentials. The [QA record](submission/QA.md) distinguishes accepted wallet/workspace behavior from unverified paths.
