import "server-only";
export function assertOrigin(request: Request) {
  const expected = process.env.PORTOVA_ORIGIN ?? (process.env.NODE_ENV === "production" ? "https://portova.vercel.app" : new URL(request.url).origin);
  if (request.headers.get("origin") !== expected) throw Object.assign(Error("Open Portova on its configured site to make this request."), { status: 403 });
  return expected;
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw Object.assign(Error("Send JSON."), { status: 400 });
  if (Number(request.headers.get("content-length")) > 16000) throw Object.assign(Error("Request too large."), { status: 413 });
  const reader = request.body?.getReader(); if (!reader) throw Error("Missing request.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 16000) { await reader.cancel(); throw Object.assign(Error("Request too large."), { status: 413 }); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw Object.assign(Error("Invalid JSON."), { status: 400 }); }
}
export function apiError(cause: unknown) {
  const status = (cause as { status?: number })?.status ?? 503;
  return Response.json({ error: status >= 500 ? "Project storage is temporarily unavailable. Your local project is unchanged." : cause instanceof Error ? cause.message : "Request failed." }, { status, headers: { "Cache-Control": "no-store" } });
}
