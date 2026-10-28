import { createConfig, createStorage, http, injected } from "wagmi";
import { EVM_HTTP, portaldotTestnet } from "@/lib/network";

export const wagmiConfig = createConfig({
  chains: [portaldotTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [portaldotTestnet.id]: http(EVM_HTTP),
  },
  ssr: true,
  // EVM connection state is optional. Do not acquire localStorage during app startup:
  // its getter can throw before the browser's Substrate/read-only UI has mounted.
  storage: createStorage({ storage: {
    getItem: key => { try { return typeof window === "undefined" ? null : window.localStorage.getItem(key); } catch { return null; } },
    setItem: (key, value) => { try { if (typeof window !== "undefined") window.localStorage.setItem(key, value); } catch { /* Optional connection persistence. */ } },
    removeItem: key => { try { if (typeof window !== "undefined") window.localStorage.removeItem(key); } catch { /* Optional connection persistence. */ } },
  } }),
  multiInjectedProviderDiscovery: true,
});
