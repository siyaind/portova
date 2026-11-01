import { database } from "@/lib/server/project-db";
import { clientLimit, cached } from "@/lib/server/redis";
import { TESTNET_GENESIS } from "@/lib/network";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await clientLimit(request, "network-activity", 90);
    const result = await cached(
      "public-activity:" + TESTNET_GENESIS,
      30,
      async () => {
        const sql = database();
        const [indexer] =
          await sql`SELECT start_height,height,updated_at FROM portova_indexer WHERE genesis=${TESTNET_GENESIS}`;
        // Only public blockchain facts. Workspace audit records never enter this feed.
        const events =
          await sql`SELECT height,tx_hash,tx_index,call,success FROM portova_events WHERE genesis=${TESTNET_GENESIS} ORDER BY height DESC,tx_index DESC LIMIT 12`;
        return { indexer: indexer ?? null, events };
      },
    );
    return Response.json(result.value, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Indexed activity is temporarily unavailable." },
      { status: 503 },
    );
  }
}
