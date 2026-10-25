# Deployment and release record

October 24 production baseline. Subsequent code follows GitHub main and its Vercel/GitHub Actions checks. The October 25 code changes and validation scope are recorded in REVIEW_FOLLOWUP.md.

## Current update: deployed to production

Treasury review/withdrawal, wallet lifecycle guards, expanded receipt recovery/backups, explorer links and the demo walkthrough are deployed at https://portova.vercel.app. The local and Vercel optimized production builds and TypeScript checks passed. All 54 unit tests passed. Local browser checks confirmed old-receipt recovery, reload persistence, export and duplicate-safe import, proceeds balance reads, and a live swap quote/minimum.

The initial account-access errors were resolved by the owner's Vercel sign-in. The October 24 deployment completed with READY state and the production alias assigned.

The existing project link was preserved and verified as siyaind/portova: project prj_VXtSSWbmjboTVuoAu4KrNoiLsxbN, org team_S3PIhnT1WQlPFyFavSWZJdqP.

- Deployment ID: dpl_7av1mpCeeDfQQTpWHVmCSZiNf7La.
- Immutable URL: https://portova-bhjekre9p-siyaind.vercel.app.
- Production alias: https://portova.vercel.app.
- Live walkthrough: https://portova.vercel.app/demo/index.html.
- Video: https://portova.vercel.app/demo/portova-walkthrough.mp4.
- Verification: /, /treasury, /activity, /swap, /settings and /demo/index.html returned HTTP 200 with the updated content. The MP4 returned HTTP 200, video/mp4, 471518 bytes. The production landing page was also opened in the browser.

## Reproduce the release

```sh
vercel login
vercel whoami
vercel project inspect portova
npm test
npm run typecheck
npm run build
vercel deploy --prod --yes
```

Sign in as an account authorized for the existing project, then verify the returned READY deployment and production alias. Local environment files are excluded from source upload.

## Local preview and package

```sh
npm ci
npm run build
npm run start
```

Open http://localhost:3000. The included 60-second captioned captured-screen walkthrough is at /demo/index.html, with video /demo/portova-walkthrough.mp4. It shows real product screens and historical receipt recovery; no new treasury signature is represented.

No environment file is required. .vercelignore excludes .env, .env.*, .git, .vercel, .next, node_modules, logs, tsbuildinfo and out. Never upload a local environment file to diagnose authentication.

## Previous confirmed production release

The October 22 design refresh was confirmed READY at https://portova.vercel.app with deployment dpl_615UYTXwcrNaPANELYwGybT8zMKV and immutable URL https://portova-45svp8vgz-rishu4436s-projects.vercel.app. This is historical evidence and does not mean the October 24 changes are live.

## Network and transactions

The app uses wss://test-node-v3.portaldot.dev, EVM chain id 420420777, native tPOT with 14 decimals and SS58 42. Signing requires the verified testnet genesis. The [official testnet explorer](https://scanner-testnet-v3.portaldot.dev) is used for receipt links. No custom contract, AMM, backend indexer or mainnet switch is deployed.

[Fresh network and old-receipt evidence](submission/network-evidence.json) records finalized block 174536 and successful recovery of the historical swap at block 159687. A human must still rehearse and sign a fresh treasury transfer. Event requirements and remaining team deliverables are in [the checklist](submission/CHECKLIST.md).
