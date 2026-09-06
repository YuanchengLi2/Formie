import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { APPROVED_BROWSER_ORIGINS, withRequestIdentifier } from "../_shared/request-security.ts";
import { withCors } from "../_shared/cors.ts";
import { referralContextHandler } from "./handler.ts";

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function createOpaqueToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return withCors(request, new Response(null, { status: 204 }));
  const origin = request.headers.get("Origin");
  if (origin && !APPROVED_BROWSER_ORIGINS.has(origin)) return withCors(request, new Response(JSON.stringify({ code: "ORIGIN_NOT_ALLOWED" }), { status: 403, headers: { "Content-Type": "application/json" } }));
  if (request.method !== "POST") return withCors(request, new Response(JSON.stringify({ code: "METHOD_NOT_ALLOWED" }), { status: 405, headers: { "Content-Type": "application/json" } }));
  const length = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(length) && length > 4_096) return withCors(request, new Response(JSON.stringify({ code: "PAYLOAD_TOO_LARGE" }), { status: 413, headers: { "Content-Type": "application/json" } }));
  const admin = createAdminClient();
  const clientAddress = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitSalt = Deno.env.get("ANALYTICS_IP_HASH_SALT") ?? "referral-context";
  const rateLimitKey = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${rateLimitSalt}:${clientAddress}`)));
  const response = await referralContextHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    hashToken: async (token) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
    createToken: createOpaqueToken,
    issueCode: async ({ code, tokenHash }) => {
      const { data: allowed, error: rateError } = await admin.rpc("consume_creator_auth_rate_limit", { p_key_hash: rateLimitKey, p_action: "code_validation", p_window_seconds: 900, p_max_attempts: 30 });
      if (rateError) throw rateError;
      if (allowed !== true) throw new Error("RATE_LIMITED");
      const { data, error } = await admin.rpc("issue_creator_code_visit", { p_code: code, p_token_hash: tokenHash, p_environment: Deno.env.get("REFERRAL_ENVIRONMENT") === "sandbox" ? "sandbox" : "production" });
      if (error) throw error;
      return data;
    },
    preview: async (tokenHash) => {
      const { data, error } = await admin.rpc("preview_referral_visit", { p_token_hash: tokenHash });
      if (error) throw error;
      return data;
    },
    claim: async ({ tokenHash, userId, method }) => {
      const { data, error } = await admin.rpc("claim_referral_visit", { p_token_hash: tokenHash, p_user_id: userId, p_method: method });
      if (error) throw error;
      return data;
    },
    status: async (userId) => {
      const { data, error } = await admin.from("account_referrals").select("attributed_at,creators(display_name)").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    finalize: async ({ userId, tokenHash, method, profile, acquisition }) => {
      const { data: authResult, error: authError } = await admin.auth.admin.getUserById(userId);
      if (authError || !authResult.user) throw authError ?? new Error("USER_NOT_FOUND");
      const metadataName = typeof authResult.user.user_metadata?.display_name === "string" ? authResult.user.user_metadata.display_name.trim() : "";
      const emailName = authResult.user.email?.split("@")[0]?.trim() ?? "";
      const displayName = (metadataName.length >= 2 ? metadataName : emailName.length >= 2 ? emailName : "Formie Athlete").slice(0, 60);
      const { data, error } = await admin.rpc("finalize_onboarding_with_referral", {
        p_user_id: userId,
        p_profile: { ...profile, displayName },
        p_acquisition: acquisition,
        p_token_hash: tokenHash,
        p_method: method,
      });
      if (error) throw error;
      return data;
    },
  });
  return withCors(request, withRequestIdentifier(request, response));
});
