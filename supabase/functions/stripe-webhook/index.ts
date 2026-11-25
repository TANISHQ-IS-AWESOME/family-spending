import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

// Receives Stripe's events and keeps sp_entitlements in step with each subscription.
// verify_jwt is off: Stripe signs every event, and anything without a valid signature is refused.
// In Stripe, add an endpoint for this function's URL with these events:
//   checkout.session.completed, customer.subscription.created,
//   customer.subscription.updated, customer.subscription.deleted
// then save its signing secret as STRIPE_WEBHOOK_SECRET in Supabase.

const KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let stripe: Stripe | null = null;
const getStripe = () => (stripe ??= new Stripe(KEY, { httpClient: Stripe.createFetchHttpClient() }));
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const STATUS: Record<string, string> = { active: "active", trialing: "trialing", past_due: "past_due" };

const idOf = (x: unknown) => (typeof x === "string" ? x : (x as { id?: string } | null)?.id || null);

async function userFor(sub: Stripe.Subscription, hint?: string | null) {
  if (sub.metadata?.user_id) return sub.metadata.user_id;
  if (hint) return hint;
  const customer = idOf(sub.customer);
  if (!customer) return null;
  const { data } = await admin.from("sp_entitlements").select("user_id").eq("stripe_customer_id", customer).maybeSingle();
  return (data?.user_id as string) || null;
}

async function save(sub: Stripe.Subscription, hint?: string | null) {
  const uid = await userFor(sub, hint);
  if (!uid) { console.warn("No Tilly account for subscription", sub.id); return; }
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const endSec = (sub as unknown as { current_period_end?: number }).current_period_end ?? item?.current_period_end ?? null;
  const status = STATUS[sub.status] || "canceled";

  const { data: cur } = await admin.from("sp_entitlements")
    .select("status, source, current_period_end, stripe_subscription_id").eq("user_id", uid).maybeSingle();
  if (cur && status === "canceled") {
    // a gift or a Pro code outlasts an ended subscription
    const giftLive = (cur.source === "code" || cur.source === "grant") && cur.status === "active" &&
      (!cur.current_period_end || new Date(cur.current_period_end) > new Date());
    // an old subscription ending must not cancel a newer one
    const older = cur.source === "stripe" && cur.stripe_subscription_id && cur.stripe_subscription_id !== sub.id;
    if (giftLive || older) return;
  }
  // a live subscription always has an end date; never treat it as "no end"
  const end = endSec ? new Date(endSec * 1000) : new Date(Date.now() + 35 * 864e5);
  const row = {
    user_id: uid,
    status,
    source: "stripe",
    plan: item?.price?.recurring?.interval === "month" ? "month" : "year",
    current_period_end: end.toISOString(),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    stripe_customer_id: idOf(sub.customer),
    stripe_subscription_id: sub.id,
    updated_at: new Date().toISOString(),
  };
  const r = await admin.from("sp_entitlements").upsert(row, { onConflict: "user_id" });
  if (r.error) throw r.error;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!KEY || !WEBHOOK_SECRET) return new Response("Stripe isn't set up yet", { status: 503 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(raw, req.headers.get("stripe-signature") || "", WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;
        const subId = idOf(cs.subscription);
        if (cs.mode === "subscription" && subId) await save(await getStripe().subscriptions.retrieve(subId), cs.client_reference_id);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await save(event.data.object as Stripe.Subscription);
        break;
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response("Error", { status: 500 });
  }
});
