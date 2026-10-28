# Cloud projects and shared discovery

October 28, 2026 implementation. Cloud features require the services below; deploying code alone does not provision them.

## Provisioning

Connect Neon Postgres and Upstash Redis to the existing Vercel Portova project. Enable Production (and Preview only if it has a separate test database). Keep credentials in Vercel, never in Git or chat.

- Postgres: `DATABASE_URL` (or `POSTGRES_URL`).
- Redis REST: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or the integration's `KV_REST_API_URL` and `KV_REST_API_TOKEN`).
- `PORTOVA_ORIGIN` is optional for production's `https://portova.vercel.app`; set an exact origin for another deployment hostname. Wildcards are not accepted.

Apply `scripts/cloud-schema.sql` once using the database SQL console or a secure local migration runner. It only creates Portova tables/indexes if absent. Redeploy after connecting integrations. GET `/api/projects/status` reports whether credentials are configured, not whether the database schema and services are healthy.

## Data and permissions

Local drafts remain local until Save to cloud. The cloud record contains the project name, linked token/collection/pool IDs, reference account, launch plan, description, publisher and revision. Receipts and NFT recovery checkpoints are not backed up by this feature; export receipts separately.

Each save or private list requires a fresh Substrate message signature. The server creates a five-minute, single-use challenge binding origin, account, action, exact normalized payload hash and nonce. It verifies the signature and consumes the challenge atomically. Updates also require matching owner and cloud revision; concurrent writes return 409. Loading the project is required before updating a previously saved cloud record. No wallet key, seed, or persistent login token is stored.

Publishing is explicit. `/projects/[id]` serves only published records. Unpublishing requires a signed save and prevents future reads from that endpoint; previously downloaded copies cannot be recalled. The publisher's claim to linked objects is distinct from chain ownership, shown by Launch Health. The public page does not expose browser-local receipts. Public links are not an indexed marketplace or endorsement.

Redis stores short-lived finalized discovery pages and rate-limit counters, not project records or wallet credentials. Cache keys bind genesis, object kind, finalized block and cursor. Head pointers expire after 15 seconds and pages after 60 seconds. Browser discovery falls back to direct RPC if the service is unavailable. Balances, permissions, fees and post-sign preflight continue to read the chain directly. Cloud mutations fail closed if the rate limiter or database is unavailable.

## Acceptance checks after provisioning

1. Apply schema; verify status and a fresh discovery request followed by the same block/cursor request (response header `X-Portova-Cache: hit`).
2. With a disposable test wallet, save privately, list, reload and restore. Reject a signature and switch accounts while the signing dialog is open; no save should occur.
3. Publish, open the link in another browser, then unpublish and confirm it returns 404. Verify another wallet cannot alter the record.
4. Save from two devices at the same revision; only the first write succeeds. Load the newer revision before retrying.
5. Replay an accepted challenge and try an expired/wrong-owner signature; all must fail. No secrets should appear in error responses.
6. Disconnect Redis/Postgres in a separate preview environment. Cloud saves should stop with a friendly message; local and chain features should remain usable.

## Manual transaction regression checks

The owner performs wallet signing. Retest LP10 initial deposit (including the reserved LP-account deposit), a subsequent deposit, removal and a swap. Review estimated fees, reserves, IDs and minimum received. Retest non-issuer token/NFT mint, duplicate NFT item ID, small initial liquidity, rejection, account switch/disconnect during approval, and pending-to-finalized receipt recovery. Start a new NFT launch after completing the previous one. Test two-tab project conflicts and blocked localStorage. These fixes and unit tests are not a security audit or proof of successful live wallet execution.
