# PORTOVA security model

Status: Phase 0. No contracts are deployed. This is not an audit.

Date: 2026-10-19

## Trust boundaries

| Actor | May do | Must not do |
|---|---|---|
| User wallet | Sign its own extrinsics and EVM transactions | Give a seed or private key to the app |
| PORTOVA app | Build unsigned calls, display chain reads, store off-chain project text | Move funds, substitute a recipient, or mark a trade successful without a chain result |
| Indexer, when it exists | Store events the node emitted | Invent balances, prices, or receipts |
| Asset issuer / admin / freezer | Mint, burn, freeze, or change metadata while those roles remain | Be hidden. The token page lists the current accounts |
| Collection owner | Change unlocked settings, withdraw only by an explicit transfer | Sweep buyers or redirect sale proceeds into a pool |
| Sudo on testnet | Anything the runtime allows a root key to do | Be treated as a normal user. Real value does not go to this network |
| Revive contract, later | Only the powers in its code | Custody assets without a withdrawal path the UI explains |

The testnet `Sudo.Key` storage value is set. Spec version 3002 is a `3.0.0-dev` node build. Peers observed: 2, and `shouldHavePeers` is false. This network can be halted or rewritten by its operator. It is fit for a hackathon demonstration and unfit for savings.

## Chain risks that are already visible

- Legacy mainnet and V3 testnet are different runtimes. A wallet pointed at `wss://mainnet.portaldot.io` is on node 2.0.0, spec 1002. The app must refuse any endpoint other than the two verified testnet URLs.
- Native POT has 14 decimals and the on-chain symbol `tPOT`. An EVM wallet assumes 18 decimals unless Revive's ratio is proven. Showing the EVM balance as POT before that check would mis-state funds.
- The guide states that an H160 derived for Portaldot is not the Ethereum address for the same key, and that native funding must go to the mapped SS58 account. There is no documented recovery for a mistaken transfer. The send screen has to show the mapped address and require the user to confirm it.
- `eth_getLogs` and `eth_getTransactionReceipt` disagree for at least one historical hash. A log is not a receipt. The UI waits for an inclusion result from the client that submitted the transaction.
- Historical EVM state on the public RPC is discarded. Analytics that need old state come from a Substrate indexer or they stay unavailable.
- `AssetConversion` has no pools. A quote function must return "no pool" rather than a price.
- Native NFT `buy_item` pays the seller in POT. It is not a fee-splitting marketplace. Building a fee into the UI without a contract would be a false charge.
- No royalty field exists in the NFT metadata strings. A royalty line must not be shown as collected.
- Issuer mint authority is an admin power. If the creator keeps it, the token page says the supply can increase. If they remove it, the page shows the role empty.
- `IBridge` is not in this runtime. Any bridge button would be a false capability.
- Ethereum contract patterns are not automatically safe on Revive. Upstream Revive notes include no 63/64 gas rule, tight memory and calldata limits, and different `create` semantics for PolkaVM. This runtime does serve Solidity bytecode, which suggests the EVM interpreter path is on. That still does not prove Uniswap-style contracts. No such port is in scope.
- Storage deposits can lock POT. Fee and deposit estimates are shown when a dry-run returns them.

## Rules for later contracts

Apply only if a phase actually adds a contract.

- Own the minimal surface. Do not import an AMM.
- Initialize once. No redeploy-over-state.
- Access control on every admin call, with the admin visible in the app.
- Reentrancy protection on every call that moves a token or NFT.
- Checks-effects-interactions, and pallet or token return values checked.
- Supply minted equals supply allocated. A claim cannot pay twice.
- Deadlines and slippage on swaps, using the pallet's minimum-out arguments.
- Marketplace buy checks the current owner and the current price, and cancels cleanly.
- Treasury withdrawal goes to an address the creator just confirmed.
- No upgrade proxy unless the UI says who can upgrade it.
- Tests cover the accounting identities before any public testnet liquidity. An external review is required before mainnet. Mainnet is not in this program.

## Application rules now

- No private keys, seeds, or RPC credentials with write scope in the repository or docs.
- No `.env` committed. A later local file may hold only public RPC URLs.
- Wallet connections are read and sign. There is no backend signer.
- Empty numbers stay empty. Loading and failure are different states.
- Testnet and mainnet are labeled. Mainnet is absent until it is verified.
- Submitted, included, and finalized are different labels.
- Off-chain project text is labeled off-chain.
- Dependencies stay limited to the framework, wallet libraries, and chain clients named in `docs/ARCHITECTURE.md`.

## Threats to test in later phases

- Wrong SS58 mapping drains a test transfer.
- Decimal scaling shows a 10,000x POT balance.
- Swap enabled with zero reserves.
- Issuer mints after the UI said supply was fixed.
- `buy_item` races a cancel.
- Indexer gap displayed as a zero balance.
- EVM receipt null displayed as success because a log once existed.
- Project proceeds account differs from the account the creator watches.

Phase 7 runs these against the testnet flows that were actually built. A phase that ships no contract still reconciles every extrinsic hash from the demo script.

## Phase 7 result

Date: 2026-10-19. No demo script submitted an extrinsic, so the hash list is empty. Details are in `docs/DEPLOYMENT.md`.

- Native balances use 14 decimals from `System.Account`. An EVM native balance stays hidden and is not shown as tPOT.
- Swap submit stays disabled while `AssetConversion.pools` is empty and the node returns no quote.
- The token page says the issuer can mint more while that role is set. Supply is the current Assets record.
- `buy_item` was not submitted. Trading is off, so the cancel race was not executed.
- Activity labels indexed history and EVM receipts unavailable. A gap is not shown as zero.
- Treasury reads the proceeds account on the local project. Withdrawal is not built, so the SS58-drain case was not executed as a transfer. The project form still rejects an address that fails the prefix 42 check.
- A later signed hash stays in this browser. After reload the stored status is shown and is not queried again.
