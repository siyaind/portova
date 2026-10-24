# Demo walkthrough

Live app: https://portova.vercel.app. Use Portaldot V3 Testnet. Fixed balances and quotes from earlier rehearsals are obsolete; show the values read at recording time.

A prepared 60-second captioned captured-screen walkthrough is live at https://portova.vercel.app/demo/index.html, with the MP4 at https://portova.vercel.app/demo/portova-walkthrough.mp4. It shows actual product screens and historical receipt recovery, without a new treasury signature. The longer recording plan below is for a human-presented final demo.

## Three-minute recording plan

| Time | Show | Explain in your own words |
|---|---|---|
| 0:00–0:20 | Landing page, enter workspace, live block | Creator tools using native Portaldot runtime pallets |
| 0:20–0:45 | Token 9194 and collection 7 | Stored asset/collection state; no custom contract address |
| 0:45–1:15 | Liquidity and Swap | Runtime reserves/quote, fee and minimum output; do not imply a quote is a signed transaction |
| 1:15–1:45 | Treasury | Link your proceeds account in Studio, review recipient/amount/fee, then cancel or have the account owner approve a small testnet transfer |
| 1:45–2:25 | Activity | Recover the historical swap with inclusion block 159687; show Finalized, export receipts, and the explorer |
| 2:25–2:50 | Market and network settings | Trading disabled by Nfts.Features 0; verified testnet genesis and explorer |
| 2:50–3:00 | Repository and live site | Runnable source, tests, integration evidence and remaining scope |

The owner performs any real wallet connection/signature. No seed phrase or wallet popup containing private information belongs in a recording. The prepared product walkthrough is read-only and does not claim a new treasury transfer.

## Reproducible recovery

1. Open Activity and wait for the testnet connection.
2. Paste hash `0xf60fcae4e346fc06e0e4164ffa37c0ea0494baa73c10b72c9a491b2dbeb86095`.
3. Enter inclusion block `159687`, then Find receipt.
4. Wait for Finalized. It must show extrinsic index 1 and the independent explorer link.
5. Reload. The receipt remains. Export and import are safe to demonstrate with this public record.

Historical evidence and its verification date are in [EVIDENCE](submission/EVIDENCE.md). Human wallet QA is in [QA](submission/QA.md).
