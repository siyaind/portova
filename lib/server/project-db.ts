import "server-only";
import { neon } from "@neondatabase/serverless";
import type { CloudProject } from "@/lib/cloud-project";
export function databaseConfigured() { return !!(process.env.DATABASE_URL ?? process.env.POSTGRES_URL); }
export function database() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw Object.assign(Error("Cloud projects are not configured yet. Your local project is unchanged."), { status: 503 });
  return neon(url);
}
export function cloudRow(row: Record<string, unknown>): CloudProject {
  return { id: String(row.id), owner: String(row.owner), revision: Number(row.revision), project: row.project as CloudProject["project"], description: String(row.description), published: row.published === true, updatedAt: String(row.updated_at) };
}
