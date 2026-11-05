# Deployment

Production: https://portova.vercel.app · Repository: https://github.com/siyaind/portova

Vercel's GitHub integration deploys `main`. GitHub Actions runs tests, type checking and the production build. A pushed commit is not a successful release until CI and the Vercel deployment complete successfully.

## Local verification

Use Node.js 22+.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run start
```

Open http://localhost:3000. Chain reads use the configured testnet endpoints. Cloud features need separately configured services; see [cloud projects](CLOUD_PROJECTS.md).

## Production configuration

Vercel functions use `iad1`. Neon Postgres and Upstash Redis are connected to Production in the same region. Keep Preview/staging storage separate from Production.

Configure database/Redis credentials, `PORTOVA_ORIGIN`, `RATE_LIMIT_SALT` and `CRON_SECRET` through provider/hosting settings. No server secret should use a `NEXT_PUBLIC_` variable. Environment files, dependencies, build outputs and local artifacts are excluded from Git and deployment uploads.

`vercel.json` invokes `scripts/production-build.mjs`. On a Vercel Production build it applies checksummed migrations under a database lock before building Next.js. A migration failure stops promotion. Local and Preview builds do not apply production migrations. Never edit an applied migration; add a new version.

## Release checks

1. Verify the intended commit and passing CI/Vercel status.
2. Check the live landing page and affected routes, including direct refresh/query links.
3. GET `/api/projects/status`: storage should be available and billing should remain false during the pilot.
4. Check worker health/lag through the protected operational endpoints. A successful deployment alone does not prove monitoring delivery.
5. Confirm existing public/private project access and published data are intact when changing storage behavior.

Releases must preserve explicit wallet approval, disabled checkout and external-only bridging unless a separately approved change alters those policies.

## Recovery

Use Vercel's deployment history for application rollback. A rollback does not reverse database migrations or chain transactions. Preserve additive schema compatibility, backups and incident evidence. Detailed worker, backup, restore and incident procedures are in the [production runbook](PRODUCTION_RUNBOOK.md).
