import { defineChain } from "viem";

export const SUBSTRATE_WS = "wss://test-node-v3.portaldot.dev";
export const EVM_HTTP = "https://test-evm-rpc-v3.portaldot.dev";
export const CHAIN_ID = 420420777;
export const NATIVE_SYMBOL = "tPOT";
export const NATIVE_DECIMALS = 14;
export const SS58_PREFIX = 42;
export const TESTNET_GENESIS = "0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd";
export const NODE_CONSOLE = "https://node-console.portaldot.dev";
export const BLOCK_EXPLORER = "https://scanner-testnet-v3.portaldot.dev";

export const portaldotTestnet = defineChain({
  id: CHAIN_ID,
  name: "Portaldot V3 Testnet",
  nativeCurrency: {
    name: "tPOT",
    symbol: NATIVE_SYMBOL,
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [EVM_HTTP] },
  },
  testnet: true,
});
