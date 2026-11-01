# Professional workspace release — November 1, 2026

Portova retains its dark violet identity. The work focuses on clear tasks, readable interfaces and truthful product data. These are design decisions supported by research, not a claim that usability has already been proven with customers.

## Research and design decisions

- [Linear’s March 2026 design refresh](https://linear.app/now/behind-the-latest-design-refresh) describes quiet navigation, consistent controls and keeping the current task in focus. Portova now has focused navigation, a canonical workspace and quieter app surfaces.
- [Nielsen Norman Group: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) supports moving occasional complexity behind secondary destinations. Rehearsal tools now live under Developer tools; billing recovery and detailed chain facts are expandable.
- [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) informs higher-contrast supporting text and readable controls. These changes are not a full WCAG conformance certification.
- [W3C motion guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) informs a landing animation pause control, reduced-motion support and removal of continuous app background motion.
- [OpenSea’s provenance documentation](https://support.opensea.io/en/articles/17667985-external-profiles-and-social-aggregation) distinguishes publisher attribution from endorsement. Portova labels community publication, dated chain roles, examples and reviewed profiles separately.

## Product behavior

Production deployment uses Vercel’s existing GitHub integration. `scripts/production-build.mjs` runs the checksum-checked migrations through the existing direct Neon connection before building; failure stops promotion. Local and Preview builds never run those production migrations. Checkout is disabled by release policy in addition to the environment flag.

- `/explore`: opt-in public project directory; searchable, category-filtered and cursor-paginated. Empty states are honest. Private, hidden and incomplete entries stay out. Known Portova rehearsal assets and self-declared examples are excluded by default.
- `/network`: raw native chain discovery, including assets created outside Portova. Explicit asset-ID attribution labels known Portova examples. Pool links show the asset pair and LP ID.
- `/import`: connect, link and review existing objects. Reads roles at a finalized block and guards wallet/draft changes. Import does not establish launch provenance or transfer assets. Replacing the local draft requires an explicit acknowledgement.
- `/workspace`: signed project storage, publication, role evidence, review requests, invitations, activity, reports and support. Existing chain signing safeguards remain in place.
- `/pricing`: proposed 19/49 USDC plans; checkout stays disabled. Existing billing records remain recoverable behind an expandable section.
- Pilot: explicit signed activation, once per wallet, 30 days, five projects and three collaborators per project. Enables Team capabilities for that bounded trial. Paid entitlements take priority. Expired pilots cannot restart, and expiration removes editing/monitoring eligibility without deleting projects.
- Public account search: finalized native free/reserved balances for Substrate accounts. It does not claim token/NFT/account-history coverage or EVM/Substrate equivalence.
- Public network activity: bounded native object-related calls from the indexed finalized range, with coverage and last-updated information. No workspace audit data is exposed.
- Activity shows a catch-up warning when the indexed height is significantly behind the observed network head, or an update is over 15 minutes old. GitHub schedules are best effort, not a monitoring SLA; before a demo, manually dispatch the Project indexer and monitor workflow and confirm its actual timestamps. Reliable recurring scheduling must be demonstrated before paid monitoring is enabled.
- `/bridge`: external information and a new-tab link to `bridge.portaldot.dev/en`. No embedded transfer, automatic wallet switch or claim of testnet/user-created-token support.
- `/tools`: advanced and rehearsal tools. Native NFT trading availability is read from the runtime; the app cannot enable a disabled runtime feature.

## Publication and review

Publishing confirms the publisher wallet, not the publisher’s claims. A directory entry requires a description of at least 30 characters and a linked object. Websites accept credential-free HTTPS URLs. Role evidence is server-read at a dated finalized block and tied to the project revision/network. A missing role match is never an ownership badge.

Owners request a profile review. Operators review the actual public page and evidence, then use the protected endpoint or `scripts/review-project.mjs`. `--list` lists pending/hidden public entries. Run the script with credentials supplied through an authorized process environment; never pass CRON_SECRET as an argument. Review actions are audited. Content edits and ownership transfers invalidate approval; edits cannot restore a hidden entry.

## Human acceptance testing and demo

1. Browse landing, directory, network, plans, bridge and tools without a wallet, on desktop and mobile. Use keyboard navigation, animation pause and the OS reduced-motion preference.
2. Connect your own wallet. Import an existing token/collection, verify matching and mismatching roles, edit details, and acknowledge local-draft replacement. Confirm that no transaction signature is requested for import.
3. Save a project privately with a signed storage message. It must not appear in Discover or load through its public URL.
4. Add a useful description/category/website. Publish, refresh chain-role evidence and view the profile without a wallet in another browser. Mark rehearsal projects as examples; verify the Include examples filter.
5. Request review; operator-review the correct revision. Edit it and verify that approval disappears. Hide an example and verify that republishing cannot bypass moderation. Return the test record to its intended state afterward.
6. Activate the free pilot, inspect its expiry and limits, and retry activation. The expiry must not extend. Test invitations, acceptance, viewer/editor access and revocation using your own separate wallets.
7. Link a project with real testnet objects and allow scheduled monitoring to run. Check snapshot timestamps, indexed range, reports and supported alerts. A worker run with zero eligible projects is not monitoring acceptance.
8. Use account search for a real SS58 account. Compare balances/block to the explorer. Follow a network-activity receipt link and confirm that hash/height are prefilled; lookup is explicitly initiated by the user.
9. Test actual token/NFT/liquidity wallet operations separately, including cancellation and failed/ambiguous receipts. Runtime-disabled NFT trading must remain disabled.
10. Confirm pricing shows proposed prices with no checkout, invoice creation or payment prompt. Confirm the bridge link opens the external site and Portova never initiates bridging.

For the demo, show a genuine published example with the example filter enabled, a successful existing-project import, dated chain evidence, a monitored project snapshot and a collaborator workflow. Do not invent customers, volume or revenue. End with the proposed plans and free-pilot status. Wallet extension acceptance and real transfer testing remain the owner’s responsibility.
