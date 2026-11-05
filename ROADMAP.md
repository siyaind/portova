# Portova roadmap

Updated November 5, 2026. This is a proposed product plan, not a list of released features or a commitment to delivery dates. Each phase depends on evidence from the previous one.

## Current foundation

The V3 testnet pilot supports native asset/NFT launches, existing-project import, liquidity and swaps, private/public workspaces, accepted team roles, receipt recovery, sampled monitoring and bounded event reports. Real-wallet acceptance and focused regression results are recorded in [QA](docs/submission/QA.md).

Checkout remains disabled, the bridge stays external, and no leaderboard or reward token is live. Historical indexing is incomplete and the scheduled worker provides no real-time SLA.

## 1. Pilot quality and operating reliability

**Goal:** help small project teams use Portova repeatedly and recover confidently from failures.

- Run scoped pilots with at least three independent project teams. Measure successful activation, time to a useful workspace, weekly return use, support effort and infrastructure cost.
- Improve first-use guidance, actionable empty/error states, accessibility and the browser/wallet compatibility matrix.
- Establish a staging environment, restore and rollback drills, load/abuse tests and independent review of signing and authorization boundaries.
- Measure index lag and monitoring latency. Move to a persistent worker when the scheduled job cannot meet the agreed pilot target; make historical coverage and outages visible.
- Complete the unverified public-mint, collaborator-limit and profile-review acceptance paths before promoting those flows.

**Release gate:** documented pilot feedback, repeatable recovery drills, measured worker coverage and closure of critical defects. Testnet acceptance alone does not authorize a real-value launch.

## 2. Useful project operations

**Goal:** turn the workspace into a tool teams return to after launch.

- Configurable monitoring thresholds, alert acknowledgement, resolution notes and a useful change timeline.
- Opt-in notifications and signed webhooks with retries, delivery history and per-workspace controls.
- Project templates, clearer member onboarding and reusable launch checklists.
- Longer, explicitly bounded history and reports showing coverage, freshness and data provenance.
- Improve the project directory with clear publication/review states, categories and feedback from real project teams. Keep examples separate from community adoption metrics.

**Release gate:** pilots demonstrate repeated use of operations features and notification delivery is observable and recoverable.

## 3. User leaderboard, profiles and achievements

**Goal:** recognize useful ecosystem participation without rewarding spam or speculative trading.

| Planned feature | Behavior |
|---|---|
| User position | An opted-in wallet profile shows its rank, score breakdown and season history. Private workspaces never become public merely by joining. |
| Project leaderboard | A separate ranking for published, eligible projects. Team/project scores stay distinct from individual scores. |
| Weekly/monthly seasons | Time-bounded boards alongside an all-time contribution view; rules and score versions are published. |
| Achievements | Evidence-backed milestones such as a completed native launch, maintained project profile or accepted ecosystem contribution. |
| Personal progress | Explain the next useful milestone and why a score changed; avoid encouraging unnecessary transactions. |

### Ranking rules to validate before launch

- Score only supported, independently verifiable actions or explicitly reviewed contributions. Read-only visits, wallet connections, self-reported volume and imported receipt claims are not proof of contribution.
- Require finalized chain evidence for on-chain actions. Deduplicate by network/transaction/event identity, publish coverage and never represent missing indexed history as zero participation.
- Cap repeated actions per period, exclude known example/test projects, detect self-transfers and wash activity, and provide review/appeal handling. One wallet is not proof of one person; Sybil resistance must be tested before any reward program.
- Publish the formula, eligibility, tie-breaks, exclusions and change log. A rank is a participation measure, not a security review, investment recommendation or endorsement.
- Use explicit opt-in for public handles and wallet linkage. Support leaving the board and minimizing stored profile data; public chain records themselves cannot be erased.
- Begin with recognition and badges. Do not promise token allocations, monetary rewards, yield or prizes. Any funded campaign needs separate rules, budget, abuse review and approval.

**Release gate:** stable index coverage, a published scoring policy, a tested anti-abuse model and a small opt-in beta. Simulated or fabricated rankings must never appear as live user activity.

## 4. Sustainable commercial service

**Goal:** charge for demonstrated operational value.

- Validate proposed Pro/Team limits and pricing against pilot use, support cost and willingness to renew.
- Offer scoped assisted onboarding where teams need help; wallet approvals remain with the customer.
- Enable manual USDC-on-Base renewals only after payment acceptance, finality/replay handling, support/refund procedures and applicable commercial requirements are complete.
- Keep core chain fees and deposits distinct from Portova service fees. Do not introduce hidden swap charges or imply revenue from wallet balances.

**Release gate:** reliable operations, real customer demand, clear terms and explicit approval to enable checkout. Until then, checkout remains disabled in both release policy and configuration.

## 5. Ecosystem expansion

**Goal:** expand supported capabilities after the existing workflows are dependable.

- Add supported developer APIs, integrations and project exports based on actual team needs.
- Reassess NFT trading when the runtime enables it, with fresh permission and wallet acceptance tests.
- Evaluate mainnet only after verifying endpoints, runtime compatibility, operational controls and independent review for real-value use.
- Keep bridging external until a supported provider/route, asset eligibility, failure recovery and responsibility boundaries can be demonstrated. Do not imply arbitrary user-created tokens are bridgeable.

**Release gate:** separate technical/product approval for each integration. Mainnet and embedded bridging are not enabled by this roadmap.

## How progress is reported

Track implementation and acceptance evidence in GitHub issues and releases. Update this document as priorities change. Label features as planned, in progress, beta or released only when the corresponding code and validation exist. Customer retention, useful project outcomes and reliable operations matter more than raw wallet or transaction counts.
