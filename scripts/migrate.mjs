import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Client, neonConfig } from '@neondatabase/serverless';
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw Error('Set DATABASE_URL through the environment before migrating. Do not put credentials in command arguments.');
neonConfig.webSocketConstructor = globalThis.WebSocket;
const client = new Client(url); await client.connect();
const sql = async (text, params=[]) => (await client.query(text,params)).rows;
try {
await sql("SELECT pg_advisory_lock(718291)");
await sql("CREATE TABLE IF NOT EXISTS portova_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
const files = ['../scripts/cloud-schema.sql', ...(await readdir(new URL('./migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort().map(f=>'../scripts/migrations/'+f)];
for (const name of files) {
  const source = await readFile(new URL(name,import.meta.url),'utf8'), checksum = createHash('sha256').update(source).digest('hex');
  const existing = await sql("SELECT checksum FROM portova_migrations WHERE name=$1",[name]);
  if (existing.length) { if (existing[0].checksum !== checksum) throw Error(`Migration checksum changed: ${name}`); continue; }
  await sql("BEGIN");
  try { await client.query(source); await sql("INSERT INTO portova_migrations(name,checksum) VALUES($1,$2)",[name,checksum]); await sql("COMMIT"); }
  catch { await sql("ROLLBACK"); throw Error(`Migration failed: ${name}. Check schema compatibility; credentials have not been logged.`); }
  console.log(`Applied ${name}`);
}

} finally { await client.end(); }
