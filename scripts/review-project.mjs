// Operator-only moderation; credentials come from the environment, never arguments.
const [id, revision, status, ...reason] = process.argv.slice(2);
const origin = process.env.PORTOVA_ORIGIN ?? "https://portova.vercel.app";
if (!process.env.CRON_SECRET)
  throw Error(
    "Set CRON_SECRET in the process environment. Do not paste it into command arguments.",
  );
const list = id === "--list";
if (
  !list &&
  (!id ||
    !Number.isSafeInteger(Number(revision)) ||
    !["reviewed", "hidden", "unreviewed"].includes(status) ||
    reason.join(" ").length < 10)
)
  throw Error(
    'Usage: review-project.mjs --list OR review-project.mjs PROJECT_ID REVISION reviewed|hidden|unreviewed "Reason of at least 10 characters"',
  );
const r = await fetch(new URL("/api/ops/directory", origin), {
  method: list ? "GET" : "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CRON_SECRET}`,
  },
  ...(list
    ? {}
    : {
        body: JSON.stringify({
          projectId: id,
          revision: Number(revision),
          status,
          note: reason.join(" "),
        }),
      }),
  signal: AbortSignal.timeout(20000),
});
const result = await r.json();
if (!r.ok) throw Error(result.error ?? "Review failed");
console.log(JSON.stringify(result, null, 2));
