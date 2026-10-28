import { cloudRow, database } from "@/lib/server/project-db";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) return Response.json({ error: "Project not found." }, { status: 404 });
  try {
    const sql = database();
    const rows = await sql`SELECT * FROM portova_projects WHERE id=${id} AND published=true`;
    return rows.length ? Response.json({ project: cloudRow(rows[0]) }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "This project is private or does not exist." }, { status: 404 });
  } catch { return Response.json({ error: "Project storage is unavailable. Try again shortly." }, { status: 503 }); }
}
