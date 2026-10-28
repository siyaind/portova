import { chainApi } from "@/lib/server/chain";
import { cached, rateLimit, redisConfigured } from "@/lib/server/redis";
import { readAssetPage } from "@/lib/chain-read";
import { readCollectionPage } from "@/lib/nfts";
import { readPoolPage } from "@/lib/pools";
import { TESTNET_GENESIS } from "@/lib/network";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams, kind = params.get("kind"), cursor = params.get("cursor"), hash = params.get("blockHash");
  if (!["assets", "collections", "pools"].includes(kind ?? "") || (cursor && !/^0x[0-9a-fA-F]{2,256}$/.test(cursor)) || (hash && !/^0x[0-9a-fA-F]{64}$/.test(hash))) return Response.json({ error: "Invalid discovery request." }, { status: 400 });
  try {
    if (!redisConfigured()) return Response.json({ error: "Shared cache is not configured." }, { status: 503 });
    const head = hash ? hash : (await cached(`head:${TESTNET_GENESIS}`, 15, async () => (await (await chainApi()).rpc.chain.getFinalizedHead()).toHex())).value;
    const result = await cached(`discovery:${TESTNET_GENESIS}:${kind}:${head}:${cursor ?? "first"}`, 60, async () => {
      await rateLimit("discovery-miss", 120);
      const api = await chainApi();
      // Only accept canonical finalized snapshots, even when a client supplied a hash.
      const [header, finalized] = await Promise.all([api.rpc.chain.getHeader(head), api.rpc.chain.getHeader(await api.rpc.chain.getFinalizedHead())]);
      if (header.number.toNumber() > finalized.number.toNumber() || (await api.rpc.chain.getBlockHash(header.number.toNumber())).toHex() !== head) throw Error("Snapshot is not finalized.");
      const page = kind === "assets" ? await readAssetPage(api, cursor, head) : kind === "collections" ? await readCollectionPage(api, { cursor, blockHash: head }) : await readPoolPage(api, cursor, head);
      return { ...page, genesisHash: TESTNET_GENESIS, fetchedAt: Date.now(), blockNumber: header.number.toString() };
    });
    return Response.json(result.value, { headers: { "Cache-Control": "no-store", "X-Portova-Cache": result.cache } });
  } catch { return Response.json({ error: "Shared discovery is unavailable. Read directly from the testnet." }, { status: 503 }); }
}
