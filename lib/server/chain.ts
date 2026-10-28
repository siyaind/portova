import "server-only";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { SUBSTRATE_WS, TESTNET_GENESIS } from "@/lib/network";
let pending: Promise<ApiPromise> | undefined;
export async function chainApi() {
  if (!pending) {
    const provider = new WsProvider(SUBSTRATE_WS, 2500, undefined, 15000);
    pending = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const api = await Promise.race([ApiPromise.create({ provider, noInitWarn: true }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("RPC connection timed out.")), 18000); })]);
        if (api.genesisHash.toHex() !== TESTNET_GENESIS || api.runtimeVersion.specName.toString() !== "portaldot-v3") { await api.disconnect(); throw Error("Unexpected network."); }
        return api;
      } catch { pending = undefined; await provider.disconnect(); throw Error("The testnet is unavailable."); }
      finally { clearTimeout(timer); }
    })();
  }
  return pending;
}
