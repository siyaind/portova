# Portova

A workspace for launching and operating native assets on Portaldot V3 Testnet. Create tokens and NFT collections, manage liquidity, and coordinate a project with private cloud storage, team permissions and monitored changes.

[Live website](https://portova.vercel.app) · [Documentation](docs/README.md) · [Roadmap](ROADMAP.md) · [Demo guide](docs/DEMO.md)

## Features

- Guided token/NFT launch with persistent drafts and finalized-object linking.
- Import existing assets and inspect their finalized on-chain roles.
- Native pools, liquidity deposits/withdrawals and exact-input swaps with balance, fee and minimum-output reviews.
- Private project workspaces, explicit publication, public profiles and an opt-in project directory.
- Accepted viewer/editor invitations, revocation, revision conflict protection and audit history.
- Bounded finalized event indexing, sampled project monitoring and downloadable reports.
- Wallet-bound transaction reviews, durable NFT launch recovery and receipt export/import.

Portova uses the native `Assets`, `Nfts`, `AssetConversion` and `Balances` pallets. There is no custom Portova contract or token. Keys remain in the connected wallet; Portova never requests a seed phrase.

## Current release

Portova is a **testnet pilot**. Neon Postgres and Upstash Redis support the hosted workspace. A scheduled worker runs indexing and monitoring on a best-effort basis; historical coverage is incomplete.

Explorer is free. Proposed Pro and Team plans are 19 and 49 USDC per 30 days, respectively. **Checkout is disabled.** The free pilot provides bounded access to team features; see the [business model](docs/BUSINESS_MODEL.md).

The bridge is an external link. NFT trading remains unavailable while the runtime Trading feature is disabled. Mainnet, embedded bridging, royalties, auctions, vesting and leaderboards are not implemented. Future work is described in the [roadmap](ROADMAP.md).

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Public chain reads need no environment file. Signing requires a compatible injected Substrate wallet and testnet tPOT. Portova does not operate a faucet.

Cloud workspaces require Postgres and Redis credentials in the local or hosting environment. Follow [cloud configuration](docs/CLOUD_PROJECTS.md); never commit credentials.

```sh
npm test
npm run typecheck
npm run build
npm run start
```

The test command runs TypeScript unit/integration tests and migration checks. Tests do not sign transactions or use customer funds. Manual testnet acceptance and its limits are recorded in [QA](docs/submission/QA.md).

## Network

| Setting | Value |
|---|---|
| Substrate RPC | `wss://test-node-v3.portaldot.dev` |
| Approved runtime | `portaldot-v3`, spec version `3002` |
| Native asset | tPOT, 14 Substrate decimals, SS58 prefix 42 |
| Genesis | `0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd` |
| Explorer | [V3 testnet scanner](https://scanner-testnet-v3.portaldot.dev) |

The application checks network identity and pauses signing on an unreviewed runtime. EVM tooling is separate from native Substrate signing; see [network compatibility](docs/NETWORK_COMPATIBILITY.md).

## Main routes

| Route | Purpose |
|---|---|
| `/workspace` | Cloud projects, collaborators, audit, monitoring and support |
| `/launch` · `/import` | Start a guided launch or link an existing project |
| `/explore` · `/projects/[id]` | Public directory and published profiles |
| `/token-launchpad` · `/token/[id]` | Native asset creation and management |
| `/nft-launchpad` · `/collection/[id]` | NFT collection creation and management |
| `/liquidity?pool=17` · `/swap?pool=17` | Select a specific LP pool for liquidity or swaps |
| `/studio` · `/portfolio` · `/treasury` | Local project, holdings and reviewed proceeds transfers |
| `/activity` | Receipts, recovery and backups |
| `/network` · `/settings` | Chain discovery, network and wallet facts |
| `/pricing` · `/bridge` | Plans/pilot and external bridge information |
| `/tools` | Advanced tools, gallery/trading status and transaction rehearsal |

## Project structure

| Directory | Contents |
|---|---|
| `app/` | Next.js routes, server endpoints and styles |
| `components/` | Product screens, providers and wallet interfaces |
| `lib/` | Chain reads, transaction guards, storage, backend services and tests |
| `scripts/` | Database migrations, workers, backups and evidence tools |
| `.github/workflows/` | CI and scheduled indexing/monitoring |
| `docs/` | Architecture, setup, security, operations and validation |
| `public/demo/` | Published historical walkthrough, retained while the final demo is recorded |

## Deployment and evidence

The hosted application deploys from this repository's `main` branch through Vercel. Production builds verify additive database migrations before promotion. See [deployment](docs/DEPLOYMENT.md) and the [operations runbook](docs/PRODUCTION_RUNBOOK.md).

The current public example links asset **644897333**, collection **24** and **LP 17**. It is explicitly labelled an example, not a customer or an endorsed project. [Technical evidence](docs/submission/EVIDENCE.md) distinguishes recorded wallet results, read-only verification and historical snapshots.

This repository contains testnet software. Automated checks and successful rehearsals do not establish an independent security audit or mainnet production readiness.
