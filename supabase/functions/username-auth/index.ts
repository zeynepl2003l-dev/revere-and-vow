import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const siteOrigin = "https://rav377.netlify.app";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function response(payload: unknown, status = 200, origin = siteOrigin) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function normalizeUsername(x: unknown) {
  return typeof x === "string" ? x.trim().toLowerCase() : "";
}
function validUsername(x: string) {
  return /^[a-z][a-z0-9_]{2,23}$/.test(x) && !/^(admin|administrator|support|moderator|root|system|netlify|supabase|rav|r4|r5)$/i.test(x);
}
function validPassword(x: unknown) {
  return typeof x === "string" && x.length >= 12 && x.length <= 128;
}
function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "RAV-" + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256(input: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map(x => x.toString(16).padStart(2, "0")).join("");
}
async function throttle(key: string, max: number, seconds: number) {
  const digest = await sha256(key);
  const { data, error } = await admin.rpc("rav_take_auth_attempt", {
    p_key: digest, p_max: max, p_window_seconds: seconds,
  });
  if (error) throw new Error("Unable to verify request limit");
  return data === true;
}
function textField(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
const safeFailure = { error: "Kullanıcı adı veya şifre geçersiz." };
Deno.serve(async req => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return response({}, 204);
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  if (origin && origin !== siteOrigin) return response({ error: "Origin not allowed" }, 403);
  if (!supabaseUrl || !serviceKey || !publicKey) return response({ error: "Server configuration missing" }, 503);
  if (Number(req.headers.get("content-length") || "0") > 8192) return response({ error: "Request too large" }, 413);
  let body: Record<string, unknown>;
  try { body = await req.json(); if (!body || typeof body !== "object") throw new Error(); }
  catch { return response({ error: "Invalid request" }, 400); }
  const action = body.action;
  const username = normalizeUsername(body.username);
  if (!validUsername(username)) return response({ error: "Kullanıcı adı 3–24 karakter olmalı; harf, rakam ve alt çizgi kullan." }, 400);
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";
  try {
    if (!(await throttle("rav:"+String(action)+":name:"+username, action === "recover" ? 5 : action === "login" ? 12 : 4, action === "recover" ? 86400 : 900))) {
      return response({ error: "Çok fazla deneme yapıldı. Daha sonra tekrar deneyin." }, 429);
    }
    if (ip && !(await throttle("rav:"+String(action)+":ip:"+ip, action === "register" ? 4 : 50, action === "register" ? 3600 : 900))) {
      return response({ error: "Çok fazla istek gönderildi. Daha sonra tekrar deneyin." }, 429);
    }
    if (action === "register") {
      if (!validPassword(body.password)) return response({ error: "Şifre 12–128 karakter olmalı." }, 400);
      const displayName = textField(body.display_name, 48);
      const gameName = textField(body.game_name, 80);
      if (!displayName || !gameName) return response({ error: "Görünen ad ve oyun adı gerekli." }, 400);
      const { data: previous, error: checkError } = await admin.from("rav_username_accounts").select("username").eq("username",username).maybeSingle();
      if (checkError) throw checkError;
      if (previous) return response({ error: "Bu kullanıcı adı zaten kullanılıyor." }, 409);
      const internalEmail = "rav-" + crypto.randomUUID().replaceAll("-", "") + "@accounts.example";
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: internalEmail,
        password: String(body.password),
        email_confirm: true,
        user_metadata: { display_name: displayName, game_name: gameName, login_username: username },
      });
      if (createError || !created.user) return response({ error: "Hesap oluşturulamadı. Farklı bir kullanıcı adı deneyin." }, 400);
      const recoveryCode = randomCode();
      const recoveryHash = await sha256(recoveryCode);
      const { error: insertError } = await admin.from("rav_username_accounts").insert({
        username, user_id: created.user.id, internal_email: internalEmail, recovery_hash: recoveryHash,
      });
      if (insertError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return response({ error: insertError.code === "23505" ? "Bu kullanıcı adı zaten kullanılıyor." : "Hesap tamamlanamadı; tekrar deneyin." }, insertError.code === "23505" ? 409 : 500);
      }
      const publicClient = createClient(supabaseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: signIn, error: signError } = await publicClient.auth.signInWithPassword({ email: internalEmail, password: String(body.password) });
      if (signError || !signIn.session) return response({ error: "Hesap oluşturuldu. Kullanıcı adı ve şifrenle giriş yap.", recovery_code: recoveryCode }, 202);
      return response({ access_token: signIn.session.access_token, refresh_token: signIn.session.refresh_token, recovery_code: recoveryCode }, 201);
    }
    const { data: account, error: lookupError } = await admin.from("rav_username_accounts")
      .select("user_id,internal_email,recovery_hash").eq("username",username).maybeSingle();
    if (lookupError) throw lookupError;
    if (action === "login") {
      if (!account || typeof body.password !== "string") return response(safeFailure, 401);
      const publicClient = createClient(supabaseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: signedIn, error: signError } = await publicClient.auth.signInWithPassword({ email: account.internal_email, password: body.password });
      if (signError || !signedIn.session || signedIn.user?.id !== account.user_id) return response(safeFailure,401);
      return response({ access_token: signedIn.session.access_token, refresh_token: signedIn.session.refresh_token });
    }
    if (action === "recover") {
      if (!account || !validPassword(body.new_password) || typeof body.recovery_code !== "string") return response({error:"Kurtarma bilgileri geçersiz."},401);
      const hash = await sha256(body.recovery_code.trim());
      if (hash !== account.recovery_hash) return response({error:"Kurtarma bilgileri geçersiz."},401);
      const nextCode = randomCode();
      const nextHash = await sha256(nextCode);
      const { error: updateError } = await admin.auth.admin.updateUserById(account.user_id, { password: String(body.new_password) });
      if (updateError) throw updateError;
      const { error: recoverError } = await admin.from("rav_username_accounts").update({ recovery_hash: nextHash }).eq("user_id",account.user_id).eq("recovery_hash",hash);
      if (recoverError) throw recoverError;
      return response({ recovery_code: nextCode });
    }
    return response({error:"Unknown action"},400);
  } catch (e) {
    console.error("username-auth:", (e as Error)?.message?.slice(0,240) || "unknown");
    return response({error:"Bir sunucu hatası oluştu. Tekrar deneyin."},500);
  }
});
