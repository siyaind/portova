import {storageHealth} from "@/lib/server/health";
import {billingConfigured} from "@/lib/server/billing";
export const dynamic = "force-dynamic";
export async function GET() { const health=await storageHealth();return Response.json({available:health.available,billing:health.available&&billingConfigured(),billingMode:'crypto',paymentNetwork:'Base',paymentAsset:'USDC'}, { headers: { "Cache-Control": "no-store" } }); }
