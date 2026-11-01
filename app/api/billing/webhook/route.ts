import { stripeClient, syncSubscription } from "@/lib/server/billing";
import { readBody } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const stripe = stripeClient();
    const body = await readBody(request, 1000000);
    let event;
    try { event = stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", process.env.STRIPE_WEBHOOK_SECRET!); }
    catch { return Response.json({ error: "Invalid webhook signature." }, { status: 400 }); }
    if (["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(event.type)) {
      await syncSubscription((event.data.object as {id:string}).id, event.id, event.created);
    }
    return Response.json({ received: true });
  } catch { console.error(JSON.stringify({ event: "billing_webhook_failed" })); return Response.json({ error: "Webhook processing unavailable; retry." }, { status: 503 }); }
}
