import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Account helper for the public app (does its own auth, so verify_jwt is off).
//  - signup: creates an account that can sign in right away and returns its recovery code.
//  - new_recovery_code: replaces the signed-in account's recovery code.
//  - reset_password: sets a new password for someone who has their email + recovery code.
//  - delete_account: deletes the signed-in account and all of its data.
//  - import_legacy: copies the original family tracker's data into the signed-in account, once.

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

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---- recovery codes: 16 characters, shown once, stored as a SHA-256 hash ----
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no 0/O, 1/I/L, U
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let out = "";
  for (const b of bytes) { if (b < 240 && out.length < 16) out += ALPHABET[b % 30]; }
  while (out.length < 16) out += ALPHABET[crypto.getRandomValues(new Uint8Array(1))[0] % 30];
  return out.match(/.{4}/g)!.join("-");
}
const normalize = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
async function hash(code: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalize(code)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function issueCode(uid: string) {
  const code = newCode();
  const r = await admin.from("sp_recovery").upsert({ user_id: uid, code_hash: await hash(code), attempts: 0, locked_until: null, created_at: new Date().toISOString() });
  if (r.error) throw r.error;
  return code;
}
async function signedIn(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error || !data?.user ? null : data.user;
}
const validPassword = (p: string) => p.length >= 8 && p.length <= 72;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "bad_request" }, 405);
  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === "signup") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return json({ error: "bad_email" }, 400);
      if (!validPassword(password)) return json({ error: "weak_password" }, 400);
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data?.user) {
        const msg = String(error?.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) return json({ error: "email_taken" }, 409);
        console.error("signup error", error?.message);
        return json({ error: "server_error" }, 500);
      }
      let recovery_code: string | null = null;
      try { recovery_code = await issueCode(data.user.id); } catch (e) { console.error("recovery code failed", e); }
      return json({ ok: true, recovery_code });
    }

    if (body.action === "new_recovery_code") {
      const user = await signedIn(req);
      if (!user) return json({ error: "not_signed_in" }, 401);
      return json({ ok: true, recovery_code: await issueCode(user.id) });
    }

    if (body.action === "reset_password") {
      const email = String(body.email || "").trim().toLowerCase();
      const code = String(body.code || "");
      const password = String(body.password || "");
      if (!validPassword(password)) return json({ error: "weak_password" }, 400);
      const given = await hash(code);
      const found = await admin.rpc("sp_user_id_by_email", { p_email: email });
      const uid = found.error ? null : (found.data as string | null);
      // same answer for an unknown email, a missing code or a wrong code
      if (!uid || normalize(code).length !== 16) return json({ error: "bad_code" }, 403);
      const rec = await admin.from("sp_recovery").select("code_hash, attempts, locked_until").eq("user_id", uid).maybeSingle();
      if (rec.error || !rec.data) return json({ error: "bad_code" }, 403);
      if (rec.data.locked_until && new Date(rec.data.locked_until) > new Date()) return json({ error: "locked" }, 429);
      if (!safeEqual(given, rec.data.code_hash)) {
        const attempts = (rec.data.attempts || 0) + 1;
        const lock = attempts >= 5;
        await admin.from("sp_recovery").update({ attempts: lock ? 0 : attempts, locked_until: lock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null }).eq("user_id", uid);
        return json({ error: lock ? "locked" : "bad_code" }, lock ? 429 : 403);
      }
      const upd = await admin.auth.admin.updateUserById(uid, { password });
      if (upd.error) { console.error("reset failed", upd.error.message); return json({ error: "server_error" }, 500); }
      // each code works once: hand back a fresh one
      return json({ ok: true, recovery_code: await issueCode(uid) });
    }

    if (body.action === "delete_account") {
      const user = await signedIn(req);
      if (!user) return json({ error: "not_signed_in" }, 401);
      if (body.confirm !== "DELETE") return json({ error: "bad_request" }, 400);
      const del = await admin.auth.admin.deleteUser(user.id);
      if (del.error) { console.error("delete failed", del.error.message); return json({ error: "server_error" }, 500); }
      return json({ ok: true });
    }

    if (body.action === "import_legacy") {
      const user = await signedIn(req);
      if (!user) return json({ error: "not_signed_in" }, 401);
      const uid = user.id;
      const pass = Deno.env.get("FAMILY_PASSCODE") || "";
      if (!pass || !safeEqual(String(body.passcode || ""), pass)) return json({ error: "wrong_passcode" }, 403);

      const done = await admin.from("sp_imports").select("user_id").eq("user_id", uid).maybeSingle();
      if (done.data) return json({ error: "already_imported" }, 409);

      const [p, t] = await Promise.all([
        admin.from("purchases").select("person, date, store, item, price, category, receipt, added_at").limit(10000),
        admin.from("taxes").select("person, date, store, tax, receipt, added_at").limit(10000),
      ]);
      if (p.error || t.error) throw p.error || t.error;

      // claim the import first so two taps can't copy twice
      const flag = await admin.from("sp_imports").insert({ user_id: uid });
      if (flag.error) return json({ error: "already_imported" }, 409);

      let rowsCopied = 0;
      try {
        const existing = await admin.from("sp_profiles").select("id, name").eq("user_id", uid);
        if (existing.error) throw existing.error;
        const ids: Record<string, string> = {};
        for (const [name, color] of [["Mom", "pink"], ["Dad", "blue"]]) {
          const hit = existing.data.find((x) => x.name.toLowerCase() === name.toLowerCase());
          if (hit) { ids[name] = hit.id; continue; }
          const ins = await admin.from("sp_profiles").insert({ user_id: uid, name, color }).select("id").single();
          if (ins.error) throw ins.error;
          ids[name] = ins.data.id;
        }
        const rows = p.data.filter((x) => ids[x.person]).map((x) => ({
          user_id: uid, profile_id: ids[x.person], date: x.date, store: x.store, item: x.item,
          price: x.price, category: x.category, receipt: x.receipt, added_at: x.added_at,
        }));
        const taxes = t.data.filter((x) => ids[x.person]).map((x) => ({
          user_id: uid, profile_id: ids[x.person], date: x.date, store: x.store, tax: x.tax, receipt: x.receipt, added_at: x.added_at,
        }));
        if (rows.length) {
          const r = await admin.from("sp_purchases").insert(rows);
          if (r.error) throw r.error;
          rowsCopied = rows.length;
        }
        let taxCopied = 0;
        if (taxes.length) {
          const r = await admin.from("sp_taxes").insert(taxes);
          if (r.error) console.error("tax copy failed", r.error.message);
          else taxCopied = taxes.length;
        }
        return json({ ok: true, purchases: rowsCopied, taxes: taxCopied, taxes_expected: taxes.length });
      } catch (e) {
        if (!rowsCopied) await admin.from("sp_imports").delete().eq("user_id", uid);
        throw e;
      }
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
