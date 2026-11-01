import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
export function assertOperator(request: Request) {
  const secret=process.env.CRON_SECRET;
  const digest=(v:string)=>createHash("sha256").update(v).digest();
  if(!secret || !timingSafeEqual(digest(request.headers.get("authorization")??""),digest(`Bearer ${secret}`))) throw Object.assign(Error("Unauthorized."),{status:401});
}
