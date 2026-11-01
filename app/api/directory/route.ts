import { database } from "@/lib/server/project-db";
import { directoryEntry } from "@/lib/server/directory";
import { clientLimit } from "@/lib/server/redis";
import { PROJECT_CATEGORIES, PORTOVA_EXAMPLE_ASSETS } from "@/lib/directory";
import { DIRECTORY_SQL } from "@/lib/directory-query";
import { TESTNET_GENESIS } from "@/lib/network";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams,
    query = (p.get("q") ?? "").trim(),
    after = p.get("after") ?? "",
    category = p.get("category") ?? "All",
    examples = p.get("examples") === "true";
  if (
    query.length > 100 ||
    (after && !/^[a-zA-Z0-9-]{1,80}$/.test(after)) ||
    (category !== "All" &&
      !(PROJECT_CATEGORIES as readonly string[]).includes(category))
  )
    return Response.json(
      { error: "Invalid directory filters." },
      { status: 400 },
    );
  try {
    await clientLimit(request, "directory", 90);
    const sql = database(),
      needle = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = await sql.query(DIRECTORY_SQL, [
      TESTNET_GENESIS,
      after,
      category,
      needle,
      examples,
      [...PORTOVA_EXAMPLE_ASSETS],
      query === "",
    ]);
    return Response.json(
      {
        projects: rows.slice(0, 24).map(directoryEntry),
        nextCursor: rows.length > 24 ? String(rows[23].id) : null,
        genesis: TESTNET_GENESIS,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "The project directory is temporarily unavailable. Network discovery remains available.",
      },
      { status: 503 },
    );
  }
}
