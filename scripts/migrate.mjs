import { readFile, readdir } from "node:fs/promises";
import { migrationChecksums } from "./migration-checksum.mjs";
import { Client, neonConfig } from "@neondatabase/serverless";
const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;
if (!url)
  throw Error(
    "Set a direct Neon database URL through the environment before migrating. Do not put credentials in command arguments.",
  );
if (new URL(url).hostname.includes("-pooler."))
  throw Error(
    "Migrations require DATABASE_URL_UNPOOLED or POSTGRES_URL_NON_POOLING so the advisory lock stays on one database session.",
  );
neonConfig.webSocketConstructor = globalThis.WebSocket;
const client = new Client(url);
await client.connect();
const sql = async (text, params = []) =>
  (await client.query(text, params)).rows;
try {
  await sql("SELECT pg_advisory_lock(718291)");
  await sql(
    "CREATE TABLE IF NOT EXISTS portova_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const files = [
    "../scripts/cloud-schema.sql",
    ...(await readdir(new URL("./migrations/", import.meta.url)))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => "../scripts/migrations/" + f),
  ];
  for (const name of files) {
    const source = await readFile(new URL(name, import.meta.url), "utf8"),
      checksums = migrationChecksums(source),
      checksum = checksums.canonical;
    const existing = await sql(
      "SELECT checksum FROM portova_migrations WHERE name=$1",
      [name],
    );
    if (existing.length) {
      if (!checksums.compatible.has(existing[0].checksum))
        throw Error(`Migration checksum changed: ${name}`);
      if (existing[0].checksum !== checksum)
        await sql("UPDATE portova_migrations SET checksum=$1 WHERE name=$2", [
          checksum,
          name,
        ]);
      continue;
    }
    await sql("BEGIN");
    try {
      await client.query(source);
      await sql("INSERT INTO portova_migrations(name,checksum) VALUES($1,$2)", [
        name,
        checksum,
      ]);
      await sql("COMMIT");
    } catch {
      await sql("ROLLBACK");
      throw Error(
        `Migration failed: ${name}. Check schema compatibility; credentials have not been logged.`,
      );
    }
    console.log(`Applied ${name}`);
  }
} finally {
  try {
    await sql("SELECT pg_advisory_unlock(718291)");
  } finally {
    await client.end();
  }
}
