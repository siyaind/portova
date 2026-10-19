# Portaldot V3 network compatibility

Investigation date: 2026-10-19

A documentation claim is not treated as operational. Live evidence below comes from read-only JSON-RPC. No transaction was signed or submitted.

## Sources

- Team testnet guide, updated 2026-10-16 for the `portaldot.dev` endpoints: [portaldot-v3-testnet-guide](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide/blob/main/README.md). The repository describes itself as an English translation of the Portaldot team's testnet document. Endpoint values match the 2026-10-17 post from @Portaldot_Dev.
- Team FAQ, last updated 2026-10-07: [FAQ.md](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide/blob/main/FAQ.md).
- Older developer docs, chain websocket `wss://mainnet.portaldot.io`: [Chain Info](https://portaldot-dev.readthedocs.io/en/latest/chain-info.html).
- Hackathon article, 2026-09-28: [Portaldot Hacker House 2026](https://x.com/PortaldotL0/article/2104593132570751302).
- Submission platform checked 2026-10-19: [DoraHacks event page](https://dorahacks.io/hackathon/portaldot-hacker-house-2026).

## Verified endpoints

| Network | Endpoint | Live result on 2026-10-19 |
|---|---|---|
| V3 testnet Substrate | `wss://test-node-v3.portaldot.dev` | Open. `system_chain` = `PortaldotV3 Test`. `system_name` = `PortaldotV3 Node`. `system_version` = `3.0.0-dev-fddd43141f2`. `system_chainType` = `Live`. |
| V3 testnet EVM RPC | `https://test-evm-rpc-v3.portaldot.dev` | HTTP 200. `web3_clientVersion` = `eth-rpc/main-fddd431/x86_64-unknown-linux-gnu/rustc1.98.0`. Same build hash as the node. |
| V3 testnet console | `https://node-console.portaldot.dev` | Host responds with title `Portaldot Node Console`. |
| Legacy mainnet | `wss://mainnet.portaldot.io` | Open. `system_chain` = `Portaldot Mainnet`. `system_version` = `2.0.0-unknown-x86_64-linux-gnu`. `specName` = `portaldot`. `specVersion` = 1002. This is not V3. |
| Guessed V3 mainnet hosts | `wss://node-v3.portaldot.dev`, `wss://mainnet-node-v3.portaldot.dev`, `https://evm-rpc-v3.portaldot.dev`, `https://mainnet-evm-rpc-v3.portaldot.dev`, `https://evm-rpc.portaldot.dev`, `https://rpc.portaldot.io`, `https://evm.portaldot.io` | DNS or connect failure. |

The previous testnet host `feso-apps.xyz` no longer resolves. The guide and the 2026-10-17 developer post both say those endpoints are retired.

## Chain facts that were read

Testnet runtime:

- `specName`: `portaldot-v3`
- `specVersion`: 3002
- `implName`: `portaldot-v3-node`
- SS58 prefix: 42
- Native decimals: 14
- Native symbol from `system_properties`: `tPOT`
- Guide and MetaMask example symbol: `tPOTv3`
- EVM chain id: `420420777` (`0x190f1ca9`), confirmed by `eth_chainId` and `net_version`
- Head during the session moved from block 99184 to 99281
- Block 99184 timestamp `2026-10-19T06:12:18Z`; block 99275 timestamp `2026-10-19T06:21:24Z`; 91 blocks in 546 seconds, 6.0 seconds each for that interval
- `eth_syncing`: false
- `system_health`: 2 peers, `shouldHavePeers` false
- `Balances.TotalIssuance`: 20,046,663.383749038 tPOT in native 14-decimal units. This is issuance, not TVL.
- `Sudo.Key` storage is populated. The testnet has a root key.

EVM fee view at the tip:

- `baseFeePerGas` about `0x9867` (39015 wei)
- `eth_gasPrice` the same order of magnitude
- `eth_maxPriorityFeePerGas`: 0
- Block `gasLimit` reported as `0xffffffffffffffff`. That is the unsigned 64-bit maximum, not an Ethereum-style block gas cap.
- `eth_estimateGas` is implemented. A value transfer from an empty account returned `insufficient funds for gas * price + value`.

## Runtime modules found in metadata

Metadata magic `meta`, version 14, 561,916 bytes. Pallet names below were extracted from that metadata. Storage checks are `state_getKeysPaged` / `state_getStorage` on 2026-10-19.

Present and relevant:

| Pallet | Storage observation |
|---|---|
| `Balances` | Total issuance readable. |
| `Assets` | Metadata stored for asset id 1 (`example asset for testnet`, symbol `TST`, 18 decimals, not frozen) and asset id 2 (`test asset`, symbol `TEST`, 18 decimals, not frozen). No other metadata keys in that map. |
| `PoolAssets` | Pallet prefix exists. No pool-token issuance was interpreted. |
| `AssetConversion` | Only the storage-version key. No pool records. Call names `create_pool` and `create_pool_with_fee` are in the metadata. |
| `Nfts` | Only the storage-version key. No collection records. Call names include `set_price`, `buy_item`, and `mint_pre_signed`. No `royalty` string in the metadata. |
| `Uniques` | Only the storage-version key. |
| `Revive` | Seven `CodeInfoOf` entries. `eth_getCode` for `0xec531adadf19f263231a32310e9acb3191b898d2` returns bytecode beginning `0x6080604052`, which is standard Solidity bytecode. |
| `Contracts` | Only the storage-version key. No ink! contract info found. |
| `Vesting` | Pallet is in the runtime. This is native-balance vesting, not a creator-token schedule. |
| `NftFractionalization` | Pallet is in the runtime. No product use yet. |
| `Sudo` | Key is set. |
| `Treasury`, `Identity`, `Scheduler`, `Referenda`, `Preimage`, `Beefy`, `Babe`, `Grandpa`, `Session`, `Staking`, `Proxy`, `Indices`, `Broker`, `Paras` | Named in metadata. Not required for the first product slice. |

Not found in metadata strings: `IBridge`, `ibridge`, a user-callable XCM pallet, and NFT royalties.

`AssetConversion` is the Substrate constant-product pool pallet (the same family as Polkadot Asset Hub's Asset Conversion pallet, documented by Polkadot as Uniswap V2 logic). Its presence in this runtime is verified. Its asset-id type, fee constants, and whether a pool can be created by an ordinary account are not verified by a transaction.

## Capability matrix

| Capability | Official evidence | Live evidence | Status | Blocker |
|---|---|---|---|---|
| V3 testnet Substrate RPC | Guide and @Portaldot_Dev, 2026-10-17 | `PortaldotV3 Test`, spec `portaldot-v3` 3002 | VERIFIED | None for reads |
| V3 testnet EVM JSON-RPC | Guide, chain id 420420777 | `eth-rpc` build `fddd431`, chain id matches | VERIFIED | Historical methods are not archive-quality |
| EVM chain id 420420777 | Guide | `0x190f1ca9` and `net_version` | VERIFIED | None |
| Native symbol and 14 decimals | Guide says `tPOTv3` | `system_properties` says `tPOT`, 14 decimals | VERIFIED with a naming conflict | Display the live symbol. Do not assume MetaMask's 18-decimal view matches planck |
| V3 mainnet RPC | @PortaldotL0 said mainnet V3.0 launched 2026-10-16 | No endpoint in the testnet guide. Guessed hosts failed | UNKNOWN | No endpoint to verify. Do not ship a mainnet network |
| Legacy mainnet | readthedocs `wss://mainnet.portaldot.io` | Node 2.0.0, spec 1002, symbol `POT` | VERIFIED as legacy, not V3 | Wrong runtime for this product |
| MetaMask / Hardhat / Remix workflow | Guide sections 3.1–3.4 | Not exercised. No wallet was connected | DOCUMENTED_ONLY | H160 must be mapped with `reviveApi.accountId` before native funding. Guide says an H160 from the same key is not the Ethereum address |
| Foundry | FAQ: not tested | Not tested | UNKNOWN | Do not claim Foundry support |
| Revive / EVM bytecode execution | Guide and FAQ | Pallet present. Solidity bytecode readable at one address. Metadata describes an EVM compatibility layer | VERIFIED for code storage and reads | Ethereum equivalence for DEX-sized contracts is not proven |
| ERC-20 deployment | Hackathon announcement claims ERC-20 | No ERC-20 was deployed in this phase | DOCUMENTED_ONLY | Prove with one testnet deploy before any token UI depends on it |
| ERC-721 deployment | Hackathon announcement claims ERC-721 | No ERC-721 was deployed in this phase | DOCUMENTED_ONLY | Same as ERC-20 |
| Native fungible assets | Guide, `Assets` pallet | Two metadata records decoded | VERIFIED | Create, mint, and role changes were not submitted |
| Native NFT collections (`Nfts`) | Guide recommends `Nfts` | Pallet and sale calls are in metadata. Zero collections stored | VERIFIED module, unused | First collection still has to be created |
| Native basic NFTs (`Uniques`) | Guide | Pallet present, empty | VERIFIED module | Prefer `Nfts` for new work |
| ink! / `Contracts` | FAQ lists WASM contracts | Pallet present, no contract accounts | VERIFIED module, unused | No ink!↔Revive cross-call is documented. Do not depend on it |
| Contract event logs | Implied by Ethereum RPC | `eth_getLogs` returned 21 logs across 4 addresses in the 2,500 blocks before head 99281 | VERIFIED in that window | Not proof of full history |
| Transaction receipt by hash | Expected from Ethereum RPC | `eth_getTransactionReceipt` and `eth_getTransactionByHash` returned null for `0x397257e3dfe3a174ec11f6845a98bb7206c4569c674d2af9227f9211bc028c57`, a hash included in those logs | UNKNOWN, current lookup failed | Do not show an EVM receipt as confirmed until a same-session transaction returns one |
| Historical EVM state | Not claimed | `eth_getBlockByNumber` and historical `eth_getBalance` return `State already discarded`, including block 97201, which still appears in logs | UNSUPPORTED on this RPC | Index Substrate headers and events. Do not build charts from this EVM endpoint's past |
| Substrate block history | Not specifically claimed | Header for block 100 returned | VERIFIED | Bodies and events still need a decoder in a later phase |
| Gas estimation | Guide | `eth_estimateGas` ran | VERIFIED method | Ignore the u64-max `gasLimit` as if it were an Ethereum block cap |
| `eth_feeHistory` | Not documented | Method exists and rejected an integer block count; it wants a hex quantity | DOCUMENTED_ONLY as a quirk | Use a hex argument when tested again |
| `eth_blobBaseFee` | Not claimed | Method not found | UNSUPPORTED | None. Blob fees are irrelevant |
| EVM block explorer | Guide says leave the explorer URL empty | No explorer was found | UNSUPPORTED | Evidence is the node console plus transaction hashes |
| Node console | Guide | Host responds | VERIFIED reachable | It is not an EVM contract verifier |
| Native constant-product pools | Not in the Portaldot guide. Upstream pallet is Uniswap V2-style | `AssetConversion` in metadata, zero pools | VERIFIED module, no liquidity | Do not quote a swap. Prove `create_pool` on testnet before the swap screen is executable |
| iSwap DEX | Marketing pages on portaldot.world | No contract address, pool, or RPC integration found | DOCUMENTED_ONLY as marketing | No safe integration surface |
| Marketed NFT launchpad | Ecosystem card on portaldot.world | No product endpoint or on-chain app found | DOCUMENTED_ONLY as marketing | Build on `Nfts`, not on that card |
| Native NFT listing (`set_price`, `buy_item`) | Guide, priced in POT | Calls are in metadata. No items exist | DOCUMENTED_ONLY | Protocol fee and royalties are not in the pallet metadata |
| Creator-token vesting | Not a documented pallet feature | `Vesting` is the native-balance pallet | UNSUPPORTED for arbitrary assets | A later contract, or an explicit issuer-mint schedule. No silent custody |
| iBridge | FAQ: listed for V3.0, launch unconfirmed | No `IBridge` pallet in metadata | UNSUPPORTED on this runtime | Do not promise bridging |
| Account mapping and storage deposits | FAQ and guide | Not re-executed | DOCUMENTED_ONLY | Wrong-address POT transfers have no documented recovery |
| Mobile wallet / WalletConnect | Not in the guide | Not tested | UNKNOWN | Desktop extension first |
| Sudo | Not advertised | `Sudo.Key` is set | VERIFIED | Testnet state can be overridden. No real value |

## What this means for PORTOVA

The testnet can support a real product. The financial core should be the runtime that is actually installed: `Assets`, `Nfts`, and `AssetConversion`, with `Revive` for logic those pallets do not have.

The public EVM adapter is real and incomplete. It can read the tip, estimate gas, serve bytecode, and return recent logs. It cannot be the system's archive or the sole receipt index.

Mainnet V3 was announced. It is not an integrable network until an official endpoint is published and these same reads succeed against it.
