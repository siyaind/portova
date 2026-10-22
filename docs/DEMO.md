# PORTOVA demo script

Site: https://portova.vercel.app

Network: Portaldot V3 Testnet, chain id `420420777`, Substrate `wss://test-node-v3.portaldot.dev`. Sign nothing during the walkthrough. One wallet approval is enough: the site connection. Use the funded account `5D7b…r4GF`.

Say this once at the start: every number on screen is a chain read. List and buy stay off because the runtime Trading bit is off. This is not mainnet.

## Walkthrough

1. Open the site and connect. Wait until the header shows Portaldot V3 Testnet, chain id `420420777`, and a rising block number. The funded account should show about 432.75 tPOT. The first connection can take several seconds.
2. Open `/token/4242`. Stress Token, symbol STRS, 18 decimals, supply 1,000,500, min balance 1, 3 accounts. Status Live. This page can take about 12 seconds.
3. Open `/collection/1`. Two items, transfers on, metadata `ipfs://stress-test`. The pallet has no collection name. Choose Item 0. The owner is the funded account. If the item box is empty, type `0`.
4. Open Liquidity. Show the tPOT / STRS pool, LP token #0, reserves about 1.0391 tPOT and 962.517 STRS, swap fee 0.30%, setup fee 1 tPOT.
5. Open Swap. Enter 0.01 tPOT toward STRS. Wait for the node quote, about 9.1472 STRS out and 9.1014 minimum received. Do not swap. If asked why that is below 9.26, say the pool is thin: the difference is price impact plus the 0.30% fee.
6. Open the marketplace only after it says Trading feature Disabled. List, cancel, and buy must say Trading disabled. Explain that `Nfts.Features` is 0, so `set_price` and `buy_item` are off. Do not open the page and talk while the buttons still say Reading.

## Presenter notes

- Marketplace buttons stay disabled until the feature read finishes. If they still say List item, wait.
- The wallet dialog closes with Escape if a short screen hides Close.
- The extension can label the popup with an older page path. That label is stored by the extension.
- Collection item ids are not returned as a list. Item 0 is the demo item. Item 1 also exists on collection 1.

## Hashes already finalized

These were signed in earlier testnet runs. Do not repeat them in the demo.

| What | Hash |
|---|---|
| Create asset 6262 STC | `0x2ecef6f5154cfb5a8e7fb1251e9a480bec4b387547791be1ee11c49862e47f20` |
| Mint 500 STRS of asset 4242 to the second account | `0xd1b4a078dd8967f557087242c9eb0db39d44c8c4323c604fdf63e634c5aa57ba` |
| Public mint on collection 3 by the second account | `0xfc49f9ae1d3bafa18ca3e26405bf12db8a672e57af20c7cb479040e39de9c58e` |
| Second account mint on locked collection 1, rejected `nfts.NoPermission` | `0x0aee242ec80ec42f7df11be3948cbd6a616e93713beb5cc265c11c6e2156a5d7` |
| Funded account mint on collection 1 | `0x2c02e26d2abcfbda8013d3f432828f703a04c7f437926eacface335e01b2c225` |
| First deposit, 1 tPOT and 1,000 STRS, LP token #0 | `0xf215b625a8e09f305ed99e1e24922523499a81f5e80b6c240fdc9e062593c730` |
| Second account add, 0.1 tPOT and 100 STRS | `0xe5fc8e1a5ca75d4f96cbaae91b8cd07de0a6ab0a815f7b366c9d685153948c2e` |
| Second account remove of its own LP | `0xa4a262d164f6a09ee32476dd64f4466760f632584c32bf1fb587f05d4856e4da` |
| Swap 0.05 tPOT to STRS | `0x83c4e32d7a93d99916f670c041d8d6db51f6be1f249f189460e4226a7647ca92` |
| Swap 10 STRS to tPOT | `0x50562c2aa01a3f0f0a472e9709e2e553f4d18e8ae3d965e6dedff76e1a96a676` |
| Later 0.05 tPOT deposit | `0xe06db479d78c5e5e172c294779bc81459370a0a9d26285c90ac01b4b48bceca4` |
| Later remove of the remaining second-account LP | `0xed606614387df14ab7a268fd9c689e0bf194922959f0047c125b0f65c88c7129` |
| Oversized deposit rejected, `FundsUnavailable` | `0x2ec2cefe16c16af4fac0494d6eaf537a1847d0abefcefc9cc484982d7183a82d` |

I need to verify the STRS to tPOT hash. The user wrote `0x50562c2aa01a3f0f0a472e9709e2e553f4d18e8ae3d965e6dedff76e1a96a676`. I typed `d18c8ae` by mistake. Fix that.

From the user message:
`0x50562c2aa01a3f0f0a472e9709e2e553f4d18e8ae3d965e6dedff76e1a96a676`

Let me count: I'll copy exactly from the conversation.

"10 STRS to tPOT: `0x50562c2aa01a3f0f0a472e9709e2e553f4d18e8ae3d965e6dedff76e1a96a676`"

I wrote d18c8ae in the file. Need to fix to d18e8ae.

Also check hash length is 66 chars. I'll fix the typo.