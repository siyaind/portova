import "server-only";
export function assertOrigin(request: Request) {
  const expected =
    process.env.PORTOVA_ORIGIN ??
    (process.env.NODE_ENV === "production"
      ? "https://portova.vercel.app"
      : new URL(request.url).origin);
  if (request.headers.get("origin") !== expected)
    throw Object.assign(
      Error("Open Portova on its configured site to make this request."),
      { status: 403 },
    );
  return expected;
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw Object.assign(Error("Send JSON."), { status: 400 });
  try {
    return JSON.parse(await readBody(request, 16000));
  } catch (cause) {
    if ((cause as { status?: number }).status) throw cause;
    throw Object.assign(Error("Invalid JSON."), { status: 400 });
  }
}
export async function readBody(request: Request, maximum: number) {
  if (Number(request.headers.get("content-length")) > maximum)
    throw Object.assign(Error("Request too large."), { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) throw Error("Missing request.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximum) {
      await reader.cancel();
      throw Object.assign(Error("Request too large."), { status: 413 });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
export function apiError(cause: unknown) {
  const messages: Record<string, [number, string]> = {
    permission_denied: [
      403,
      "Your wallet does not have permission for this action.",
    ],
    revision_conflict: [
      409,
      "The cloud project changed. Load the latest version before saving.",
    ],
    plan_limit: [
      403,
      "Your workspace has reached its plan limit. Existing projects remain accessible.",
    ],
    team_required: [
      403,
      "An active Team subscription is required to invite collaborators.",
    ],
    request_expired: [400, "The request expired. Review and sign again."],
    directory_incomplete: [
      400,
      "Publish a description of at least 30 characters and link an onchain object before requesting review.",
    ],
  };
  const known = Object.entries(messages).find(
    ([key]) => cause instanceof Error && cause.message.includes(key),
  )?.[1];
  if (known)
    return Response.json(
      { error: known[1] },
      { status: known[0], headers: { "Cache-Control": "no-store" } },
    );
  const status = (cause as { status?: number })?.status ?? 503;
  if (status >= 500)
    console.error(
      JSON.stringify({
        event: "request_failed",
        category: "dependency",
        status,
      }),
    );
  return Response.json(
    {
      error:
        status >= 500
          ? "Project storage is temporarily unavailable. Your local project is unchanged."
          : cause instanceof Error
            ? cause.message
            : "Request failed.",
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
