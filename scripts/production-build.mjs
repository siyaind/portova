import { execFileSync } from "node:child_process";
// Vercel already holds the production credentials. Apply checked, additive
// migrations before the new application is promoted. Preview and local builds
// never migrate production storage.
if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production") {
  try {
    const output = execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });
    for (const line of output.split("\n"))
      if (line.startsWith("Applied ")) console.log(line);
    console.log("Production database migrations verified.");
  } catch {
    console.error(
      "Production migration failed. Deployment stopped; credentials were not logged.",
    );
    process.exit(1);
  }
}
execFileSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build", "--webpack"],
  { stdio: "inherit" },
);
