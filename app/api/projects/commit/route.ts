import { cryptoWaitReady, signatureVerify } from "@polkadot/util-crypto";
import { cloudRow, database } from "@/lib/server/project-db";
import { rateLimit } from "@/lib/server/redis";
import { apiError, assertOrigin, readJson } from "@/lib/server/http";
import { validateProjectRequest } from "@/lib/cloud-project";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertOrigin(request); const input = await readJson(request);
    if (typeof input?.id !== "string" || !/^[0-9a-f-]{36}$/.test(input.id) || typeof input.signature !== "string" || !/^0x[0-9a-fA-F]{128,132}$/.test(input.signature)) throw Object.assign(Error("Invalid signed request."), { status: 400 });
    await rateLimit("project-verify", 180);
    const sql = database();
    const challenges = await sql`SELECT * FROM portova_challenges WHERE id=${input.id} AND expires_at > now()`;
    const challenge = challenges[0]; if (!challenge) throw Object.assign(Error("This request expired or was already used. Review and sign again."), { status: 400 });
    await cryptoWaitReady();
    if (!signatureVerify(String(challenge.message), input.signature, String(challenge.owner)).isValid) throw Object.assign(Error("The signature does not match the project owner."), { status: 403 });
    const consumed = await sql`DELETE FROM portova_challenges WHERE id=${input.id} AND expires_at > now() RETURNING id`;
    if (!consumed.length) throw Object.assign(Error("This request expired or was already used."), { status: 400 });
    const payload = validateProjectRequest(challenge.payload), owner = String(challenge.owner);
    if (payload.action === "list") {
      const rows = await sql`SELECT * FROM portova_projects WHERE owner=${owner} ORDER BY updated_at DESC LIMIT 100`;
      return Response.json({ projects: rows.map(cloudRow) }, { headers: { "Cache-Control": "no-store" } });
    }
    const { project, description, published, revision } = payload;
    const rows = revision === 0
      ? await sql`INSERT INTO portova_projects(id,owner,revision,project,description,published) VALUES (${project.id!},${owner},1,${JSON.stringify(project)}::jsonb,${description},${published}) ON CONFLICT(id) DO NOTHING RETURNING *`
      : await sql`UPDATE portova_projects SET project=${JSON.stringify(project)}::jsonb,description=${description},published=${published},revision=revision+1,updated_at=now() WHERE id=${project.id!} AND owner=${owner} AND revision=${revision} RETURNING *`;
    if (!rows.length) throw Object.assign(Error("The cloud project changed or belongs to another wallet. Load your cloud projects and review before saving again."), { status: 409 });
    return Response.json({ project: cloudRow(rows[0]) }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) { return apiError(cause); }
}
