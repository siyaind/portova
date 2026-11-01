import { assertOperator } from "@/lib/server/ops";
import { database } from "@/lib/server/project-db";
import { apiError, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    assertOperator(request);
    const sql = database();
    const rows =
      await sql`SELECT id,revision,project->>'name' AS name,directory_status,review_note FROM portova_projects WHERE published AND directory_status IN ('pending','hidden') ORDER BY updated_at DESC LIMIT 50`;
    return Response.json(
      { projects: rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
export async function POST(request: Request) {
  try {
    assertOperator(request);
    const input = await readJson(request);
    if (
      !input ||
      typeof input.projectId !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(input.projectId) ||
      !Number.isSafeInteger(input.revision) ||
      !["reviewed", "hidden", "unreviewed"].includes(input.status) ||
      typeof input.note !== "string" ||
      input.note.trim().length < 10 ||
      input.note.length > 500
    )
      return Response.json(
        {
          error:
            "Provide a project, its current revision, status and review reason.",
        },
        { status: 400 },
      );
    const sql = database();
    const result = await sql.transaction((tx) => [
      tx`UPDATE portova_projects SET directory_status=${input.status},review_revision=revision,review_note=${input.note.trim()},reviewed_at=now() WHERE id=${input.projectId} AND revision=${input.revision} AND published RETURNING id`,
      tx`INSERT INTO portova_audit(project_id,actor,action,detail) SELECT id,'operator','directory-review',jsonb_build_object('status',directory_status,'revision',revision,'note',review_note) FROM portova_projects WHERE id=${input.projectId} AND revision=${input.revision} AND published AND directory_status=${input.status}`,
    ]);
    return result[0].length
      ? Response.json(
          { updated: true },
          { headers: { "Cache-Control": "no-store" } },
        )
      : Response.json(
          {
            error:
              "The project changed or is private. Re-read before reviewing.",
          },
          { status: 409 },
        );
  } catch (cause) {
    return apiError(cause);
  }
}
