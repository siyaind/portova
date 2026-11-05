# Three-minute Portova demo script

Use the current live testnet application: https://portova.vercel.app. The narration below is 338 words. Treat the timestamps as editing slots and export the final cut at 2:58–2:59, safely below three minutes.

## Recording preparation

1. Record at 1080p with readable text and notifications hidden. Recording the screen clips first and adding the narration afterward is easier than a single live take.
2. Connect Account A in each tab that needs a wallet. Tabs can retain separate wallet selections. Complete any connection or storage-message approvals before recording.
3. In the workspace tab, click **Load my workspaces**, select **Portova QA Import**, then **Read activity & alerts**. Have its dashboard, stored alerts and audit entries ready.
4. Preserve the existing example: public cloud Revision 10, asset 644897333, collection 24 and LP 17. Do not save a replacement draft, rename the project, republish or change access for the recording.
5. Preload the tabs linked in the scene list. For the NFT view, use https://portova.vercel.app/collection/24. For the liquidity view, use https://portova.vercel.app/liquidity?pool=17.
6. Prepare Activity at a genuine finalized receipt with its block/hash visible. Browser Find can locate an existing operation or block; close the Find bar before recording. Use an existing successful receipt such as asset creation at block 321441 if present.
7. Enter 0.01 tPOT at the start of the Swap clip, not before the whole recording: quotes expire after 30 seconds. Wait for the actual quote/funding check; trim loading dead time between clips if needed. Never invent an output or replace the real quote with a fixed number.
8. No new transaction is needed. Clicking **Swap** opens the app's review; **Cancel** closes it. Do not confirm that review or approve a wallet transaction in this walkthrough.

## Scenes and narration

### 0:00–0:15 — Landing page

**Open:** https://portova.vercel.app/

**Show/do:** Hold the hero section. Point briefly to the launch/workspace entry. Keep the screen still while introducing the product.

**Say:**

> Meet Portova, a launch and operations workspace for teams building on Portaldot. It brings native assets, liquidity, collaboration, and project monitoring into one place, while users keep control of their wallets.

### 0:15–0:35 — Guided launch

**Open:** https://portova.vercel.app/launch

**Show/do:** Open the Your project stage before recording so both creator-token and NFT choices are visible. Point to the choices and progress steps. Do not change the existing project or click Save.

**Say:**

> A creator starts with a guided token or NFT launch, or imports existing assets. The workflow keeps project details and linked objects together, shows required costs, and preserves progress between sessions. Each transaction needs its own wallet approval.

### 0:35–0:55 — Token and NFT collection

**Open:** https://portova.vercel.app/token/644897333

**Show/do:** Show the token's name, supply, decimals and Authority section for about 12 seconds. Switch to the preloaded collection 24 tab for the remaining eight seconds. Show actual collection details; do not mint.

**Say:**

> This is our working testnet example. Token metadata, supply, authorities, and NFT collection details are read from Portaldot. Portova uses the native Assets, Nfts, and AssetConversion pallets, so these flows do not depend on a custom Portova contract.

### 0:55–1:15 — Public project profile

**Open:** https://portova.vercel.app/projects/52936ffe-9035-49d7-a579-ea8fe6f42a3b

**Show/do:** Show Example project and Community published, the publisher/dated role evidence and the linked token, collection and LP 17 buttons. Scroll only enough to make those facts readable. Do not claim Profile reviewed.

**Say:**

> Teams can keep their workspace private or publish a project profile. This example links its token, collection, and liquidity pool. Publisher identity, dated chain-role evidence, and profile review are shown separately, so publication does not imply endorsement.

### 1:15–1:40 — Liquidity and swap

**Open:** https://portova.vercel.app/swap?pool=17

**Show/do:** Show LP 17 on the liquidity tab for five seconds, then the preloaded Swap tab with tPOT / PQA selected. Enter 0.01 tPOT at the start of this clip. Once ready, point to Expected out, Minimum received and the funding-check message. If including the cost dialog, click Swap only to open the review, hold its amounts/fees, then Cancel; never confirm or sign. Trim actual loading time between cuts if necessary.

**Say:**

> Here is the linked pool and a live swap quote. I enter a small testnet amount to see expected output and minimum received. Portova checks available balance and network fees before enabling Swap, and requires a fresh review before signing.

### 1:40–1:55 — Activity

**Open:** https://portova.vercel.app/activity

**Show/do:** Prepare the page at an existing Finalized receipt from this project's tests. Keep its operation label, hash, inclusion block and Inspect in explorer link visible. Do not trigger new recovery or import during the take.

**Say:**

> Activity contains transactions already finalized during testing, with their hashes, block numbers, and explorer links. Receipts survive reload and support backups; imported outcomes must be checked against the chain.

### 1:55–2:20 — Workspace collaboration

**Open:** https://portova.vercel.app/workspace

**Show/do:** Use the already loaded Portova QA Import dashboard. Show Role: owner, then Collaborators & workspace settings and the viewer/editor options. Do not send an invitation. Show the existing invite/accept/revoke audit entries; B is currently revoked, so do not imply B is an active member.

**Say:**

> The workspace continues after launch. Owners can invite viewers or editors, and invitations require acceptance. Editors can update project details, while publication and access remain owner-controlled. The audit trail records changes, and revocation is enforced on subsequent server requests. Workspace permissions never grant control over on-chain assets.

### 2:20–2:40 — Monitoring alerts and reports

**Open:** https://portova.vercel.app/workspace

**Show/do:** Scroll to Monitored changes and show both reserve-drop alerts at block 325864. Also show the latest monitor block/timestamp, coverage/lag information and Export current report. Export once if desired; do not spend recording time opening raw JSON.

**Say:**

> Monitoring adds ongoing operational value. In our test, these alerts recorded two pool-reserve declines after a liquidity withdrawal. Reports preserve finalized snapshots and timestamps. Coverage and indexing lag remain visible; this is sampled monitoring, not a real-time guarantee.

### 2:40–2:55 — Plans & pilot

**Open:** https://portova.vercel.app/pricing

**Show/do:** Show the proposed Explorer/Pro/Team prices and free-pilot/disabled-checkout status. Point to monitoring and collaboration benefits. Do not activate anything or open a payment flow.

**Say:**

> Portova is currently a free testnet pilot. Proposed Pro and Team plans focus on monitoring and collaboration. Checkout is disabled, and bridging remains external while we validate value with project teams.

### 2:55–3:00 — Closing

**Open:** https://portova.vercel.app/

**Show/do:** Return to the landing page, or use a simple closing card with the Portova name and portova.vercel.app. Hold still and end before the three-minute limit.

**Say:**

> Portova: launch with clarity, and keep operating with evidence.

## Final checks

- Use the actual on-screen balances, timestamps, pool reserves and receipt labels. Existing receipts are transactions completed during earlier tests, not new transactions in this video.
- The collaborator test account is revoked. Show the controls and real audit history without claiming an active collaborator who is not present.
- The R8 alerts at block 325864 are recorded test outcomes. Keep their block/timestamp visible; they are not a live guarantee or proof of an attack.
- Show the proposed 19/49 USDC prices if visible, but keep checkout disabled and pilot status clear. Do not present leaderboards, embedded bridging, mainnet or runtime-disabled NFT trading as current features.
- End on **portova.vercel.app**. Check the exported file's duration, audio and readable text, then test the uploaded video's access while signed out.
- The older https://portova.vercel.app/demo/index.html walkthrough is historical supplementary material; replace the event entry's video link with the new final recording.

[QA record](submission/QA.md) · [Integration evidence](submission/EVIDENCE.md) · [Submission checklist](submission/CHECKLIST.md)

