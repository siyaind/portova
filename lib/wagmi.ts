import { createConfig, http, injected } from "wagmi";
import { EVM_HTTP, portaldotTestnet } from "@/lib/network";

export const wagmiConfig = createConfig({
  chains: [portaldotTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [portaldotTestnet.id]: http(EVM_HTTP),
  },
  ssr: true,
  multiInjectedProviderDiscovery: true,
});
