import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

// Tilly Pro billing. Does its own sign-in check, so verify_jwt is off.
//  - config:   tells the app whether card payments are switched on (no sign-in needed)
//  - checkout: opens Stripe Checkout for the monthly or yearly plan
//  - portal:   opens Stripe's page to change card, switch plan or cancel
// Card payments stay off until these secrets are set in Supabase (Edge Functions > Secrets):
//   STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY
// and the stripe-webhook function has STRIPE_WEBHOOK_SECRET.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const PRICES: Record<string, string> = {
  month: Deno.env.get("STRIPE_PRICE_MONTHLY") || "",
  year: Deno.env.get("STRIPE_PRICE_YEARLY") || "",
};
const APP_URL = Deno.env.get("APP_URL") || "https://tanishq-is-awesome.github.io/family-spending/";
const live = () => !!(KEY && PRICES.month && PRICES.year);
let stripe: Stripe | null = null;
const getStripe = () => (stripe ??= new Stripe(KEY, { httpClient: Stripe.createFetchHttpClient() }));

type Ent = { status: string; source: string | null; current_period_end: string | null; stripe_customer_id: string | null } | null;
function isPro(e: Ent) {
  if (!e || !["trialing", "active", "past_due"].includes(e.status)) return false;
  if (!e.current_period_end) return true;
  const grace = e.source === "stripe" ? 3 * 864e5 : 0;
  return new Date(e.current_period_end).getTime() > Date.now() - grace;
}
async function signedIn(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error || !data?.user ? null : data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "bad_request" }, 405);
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "config") return json({ payments: live() });

    const user = await signedIn(req);
    if (!user) return json({ error: "not_signed_in" }, 401);
    const found = await admin.from("sp_entitlements")
      .select("status, source, current_period_end, stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (found.error) throw found.error;
    const ent = found.data as Ent;

    if (body.action === "checkout") {
      if (!live()) return json({ error: "payments_off" }, 503);
      if (isPro(ent) && ent!.source === "stripe") return json({ error: "already_subscribed" }, 409);
      if (isPro(ent) && !ent!.current_period_end) return json({ error: "already_lifetime" }, 409);
      const plan = body.plan === "month" ? "month" : "year";
      const s = getStripe();
      let customer = ent?.stripe_customer_id || null;
      if (!customer) {
        const c = await s.customers.create({ email: user.email || undefined, metadata: { user_id: user.id } });
        customer = c.id;
        const up = await admin.from("sp_entitlements")
          .upsert({ user_id: user.id, stripe_customer_id: customer, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        if (up.error) throw up.error;
      }
      const session = await s.checkout.sessions.create({
        mode: "subscription",
        customer,
        client_reference_id: user.id,
        line_items: [{ price: PRICES[plan], quantity: 1 }],
        subscription_data: { metadata: { user_id: user.id } },
        allow_promotion_codes: true,
        success_url: `${APP_URL}?pro=success#settings`,
        cancel_url: `${APP_URL}?pro=cancel#settings`,
      });
      return json({ url: session.url });
    }

    if (body.action === "portal") {
      if (!KEY) return json({ error: "payments_off" }, 503);
      if (!ent?.stripe_customer_id) return json({ error: "no_subscription" }, 404);
      const portal = await getStripe().billingPortal.sessions.create({ customer: ent.stripe_customer_id, return_url: `${APP_URL}#settings` });
      return json({ url: portal.url });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
