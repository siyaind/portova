import { createHash, randomUUID } from "node:crypto";
import { canonicalAccount, projectSignMessage, validateProjectRequest } from "@/lib/cloud-project";
import { database } from "@/lib/server/project-db";
import { rateLimit } from "@/lib/server/redis";
import { apiError, assertOrigin, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const origin = assertOrigin(request), input = await readJson(request);
    if (typeof input?.account !== "string") throw Object.assign(Error("Connect a Substrate wallet."), { status: 400 });
    const owner = canonicalAccount(input.account), payload = validateProjectRequest(input.payload);
    const sql = database();
    await rateLimit("project-global", 120);
    await rateLimit(`project:${owner}`, 10);
    const id = randomUUID(), expires = new Date(Date.now() + 5 * 60_000).toISOString();
    const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const message = projectSignMessage(origin, owner, id, expires, digest, payload.action);
    await sql`DELETE FROM portova_challenges WHERE expires_at < now()`;
    await sql`INSERT INTO portova_challenges(id, owner, payload, message, expires_at) VALUES (${id}, ${owner}, ${JSON.stringify(payload)}::jsonb, ${message}, ${expires})`;
    return Response.json({ id, message, expires }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) { return apiError(cause); }
}
