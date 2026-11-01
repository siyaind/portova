import "server-only";
import Stripe from "stripe";
import { database } from "./project-db";
import { PLANS } from "@/lib/plans";
export function billingConfigured() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return process.env.PORTOVA_BILLING_ENABLED === "true" && !!process.env.STRIPE_WEBHOOK_SECRET && !!process.env.STRIPE_PRO_PRICE && !!process.env.STRIPE_TEAM_PRICE &&
    (key.startsWith("sk_test_") || (key.startsWith("sk_live_") && process.env.BILLING_LIVE_APPROVED === "true"));
}
export function stripeClient() {
  if (!billingConfigured()) throw Object.assign(Error("Billing is awaiting configuration. No payment was taken."), { status: 503 });
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 15000, maxNetworkRetries: 1 });
}
export async function billingAction(account: string, command: {action: "billing"} | {action:"checkout"; plan:"pro"|"team"}, requestId: string) {
  const sql = database();
  const [billing] = await sql`SELECT * FROM portova_billing WHERE account=${account}`;
  if (command.action === "billing" && !billingConfigured()) return { billing: billing ?? null, configured: false };
  const stripe = stripeClient(), origin = process.env.PORTOVA_ORIGIN ?? "https://portova.vercel.app";
  if (command.action === "billing") {
    if (!billing?.customer_id) return { configured: true, billing: null, message: "No billing account yet. Choose a plan to begin." };
    const session = await stripe.billingPortal.sessions.create({ customer: String(billing.customer_id), return_url: `${origin}/workspace` }, { idempotencyKey: `portal:${requestId}` });
    return { url: session.url };
  }
  if (billing?.subscription_id && ["active","past_due","trialing","unpaid","incomplete","paused"].includes(String(billing.status))) throw Object.assign(Error("Manage your existing subscription through Billing before starting another."), { status: 409 });
  const priceId = command.plan === "pro" ? process.env.STRIPE_PRO_PRICE! : process.env.STRIPE_TEAM_PRICE!;
  const price = await stripe.prices.retrieve(priceId);
  if (!price.active || price.currency !== "usd" || price.unit_amount !== PLANS[command.plan].monthlyUsd * 100 || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) throw Error("Billing price configuration does not match the published plan.");
  let customer = billing?.customer_id ? String(billing.customer_id) : null;
  if (!customer) {
    const created = await stripe.customers.create({ metadata: { portova_account: account } }, { idempotencyKey: `customer:${account}` });
    const [saved] = await sql`INSERT INTO portova_billing(account,customer_id) VALUES(${account},${created.id}) ON CONFLICT(account) DO UPDATE SET customer_id=COALESCE(portova_billing.customer_id,EXCLUDED.customer_id) RETURNING customer_id`;
    customer = String(saved.customer_id);
  }
  const claimed=await sql`UPDATE portova_billing SET checkout_request=${requestId}::uuid,checkout_expires=CASE WHEN checkout_request=${requestId}::uuid THEN checkout_expires ELSE now()+interval '31 minutes' END WHERE account=${account} AND (checkout_expires IS NULL OR checkout_expires<now() OR checkout_request=${requestId}::uuid) RETURNING account,checkout_expires`;
  if(!claimed.length)throw Object.assign(Error("A checkout is already open for this wallet. Complete it, cancel it, or wait 31 minutes before creating another."),{status:409});
  const session = await stripe.checkout.sessions.create({ mode: "subscription", customer, expires_at: Math.floor(new Date(claimed[0].checkout_expires).getTime()/1000)-60, line_items: [{ price: priceId, quantity: 1 }], client_reference_id: account,
    subscription_data: { metadata: { portova_account: account } }, success_url: `${origin}/workspace?billing=returned`, cancel_url: `${origin}/pricing?billing=cancelled` }, { idempotencyKey: `checkout:${requestId}` });
  return { url: session.url };
}
export async function syncSubscription(id: string, eventId: string, eventCreated: number) {
  const stripe = stripeClient(), sql = database();
  const subscription = await stripe.subscriptions.retrieve(id);
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const item = subscription.items.data[0];
  const price = item?.price.id;
  const plan = price === process.env.STRIPE_PRO_PRICE ? "pro" : price === process.env.STRIPE_TEAM_PRICE ? "team" : "free";
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;
  const result = await sql.transaction([
    sql`INSERT INTO portova_billing_events(id) VALUES(${eventId}) ON CONFLICT DO NOTHING RETURNING id`,
    sql`UPDATE portova_billing SET subscription_id=${subscription.id},plan=${plan},status=${subscription.status},period_end=${periodEnd},last_event_created=${eventCreated},checkout_request=NULL,checkout_expires=NULL,updated_at=now() WHERE customer_id=${customer} AND last_event_created <= ${eventCreated}`,
  ]);
  return result[0].length;
}
