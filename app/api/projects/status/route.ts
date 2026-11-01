import {storageHealth} from "@/lib/server/health";
import {billingConfigured} from "@/lib/server/billing";
export const dynamic = "force-dynamic";
export async function GET() { const health=await storageHealth();return Response.json({available:health.available,billing:health.available&&billingConfigured(),billingMode:process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')?'test':'live'}, { headers: { "Cache-Control": "no-store" } }); }
