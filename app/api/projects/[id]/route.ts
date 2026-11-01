import { cloudRow, database } from "@/lib/server/project-db";
import { clientLimit } from "@/lib/server/redis";
import { directoryEntry } from "@/lib/server/directory";
import { TESTNET_GENESIS } from "@/lib/network";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id))
    return Response.json({ error: "Project not found." }, { status: 404 });
  try {
    await clientLimit(request, "public-project", 120);
    const sql = database();
    const rows =
      await sql`SELECT p.*,CASE WHEN e.revision=p.revision AND e.genesis=${TESTNET_GENESIS} THEN jsonb_build_object('revision',e.revision,'block',e.block_number::text,'checkedAt',e.checked_at,'assetOwner',e.facts->'assetOwner','collectionOwner',e.facts->'collectionOwner') ELSE NULL END AS evidence FROM portova_projects p LEFT JOIN portova_project_evidence e ON e.project_id=p.id WHERE p.id=${id} AND p.published=true AND p.directory_status<>'hidden'`;
    return rows.length
      ? Response.json(
          { project: cloudRow(rows[0]), directory: directoryEntry(rows[0]) },
          { headers: { "Cache-Control": "no-store" } },
        )
      : Response.json(
          { error: "This project is private, unavailable or does not exist." },
          { status: 404 },
        );
  } catch {
    return Response.json(
      { error: "Project storage is unavailable. Try again shortly." },
      { status: 503 },
    );
  }
}
