import { databaseConfigured } from "@/lib/server/project-db";
import { redisConfigured } from "@/lib/server/redis";
export const dynamic = "force-dynamic";
export function GET() { return Response.json({ available: databaseConfigured() && redisConfigured() }, { headers: { "Cache-Control": "no-store" } }); }
