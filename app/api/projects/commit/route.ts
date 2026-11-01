import { cryptoWaitReady, signatureVerify } from "@polkadot/util-crypto";
import { cloudRow, database } from "@/lib/server/project-db";
import { clientLimit, rateLimit } from "@/lib/server/redis";
import { apiError, assertOrigin, readJson } from "@/lib/server/http";
import { validateProjectRequest } from "@/lib/cloud-project";
import { billingAction } from "@/lib/server/billing";
import { verifyProjectRoles } from "@/lib/server/directory";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const input = await readJson(request);
    if (
      typeof input?.id !== "string" ||
      !/^[0-9a-f-]{36}$/.test(input.id) ||
      typeof input.signature !== "string" ||
      !/^0x(?:[0-9a-fA-F]{2}){64,66}$/.test(input.signature)
    )
      throw Object.assign(Error("Invalid signed request."), { status: 400 });
    await clientLimit(request, "commit", 30);
    const sql = database();
    const rows =
      await sql`SELECT * FROM portova_challenges WHERE id=${input.id} AND (expires_at>now() OR consumed_at>now()-interval '24 hours')`;
    const challenge = rows[0];
    if (!challenge)
      throw Object.assign(
        Error("This request expired. Review and sign again."),
        { status: 400 },
      );
    await cryptoWaitReady();
    if (
      !signatureVerify(
        String(challenge.message),
        input.signature,
        String(challenge.owner),
      ).isValid
    )
      throw Object.assign(
        Error("The signature does not match the project owner."),
        { status: 403 },
      );
    await rateLimit(`verified:${challenge.owner}`, 60);
    const payload = validateProjectRequest(challenge.payload);
    const [executed] =
      await sql`SELECT portova_execute(${input.id}::uuid) AS result`;
    const result = executed.result;
    if (payload.action === "verify")
      return Response.json(
        await verifyProjectRoles(payload.projectId, String(challenge.owner)),
        { headers: { "Cache-Control": "no-store" } },
      );
    if (payload.action === "billing" || payload.action === "checkout")
      return Response.json(
        await billingAction(String(challenge.owner), payload, input.id),
        { headers: { "Cache-Control": "no-store" } },
      );
    if (result.projects)
      result.projects = result.projects.map((row: Record<string, unknown>) => ({
        ...cloudRow(row),
        role: row.role,
      }));
    if (result.project) result.project = cloudRow(result.project);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    return apiError(cause);
  }
}
