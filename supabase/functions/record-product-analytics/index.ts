import { createAdminClient } from "../_shared/auth.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { recordProductAnalyticsHandler } from "./handler.ts";
async function sha256(value: string): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map((item) => item.toString(16).padStart(2, "0")).join(""); }
Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["POST"], authentication: "optional", maxBodyBytes: 32_768 });
  if (security) return security;
  const admin = createAdminClient(); const salt = Deno.env.get("ANALYTICS_HASH_SALT");
  if (!salt) return withCors(request, new Response(JSON.stringify({ code: "INGESTION_UNAVAILABLE" }), { status: 503, headers: { "Content-Type": "application/json" } }));
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const response = await recordProductAnalyticsHandler(request, {
    resolveUserId: async (incoming) => { const token = incoming.headers.get("authorization")?.replace(/^Bearer\s+/i, ""); if (!token) return null; const { data, error } = await admin.auth.getUser(token); return error ? null : data.user?.id ?? null; },
    ingest: async ({ userId, ipHash, events }) => { const { data, error } = await admin.rpc("ingest_product_analytics_v2", { p_user_id: userId, p_ip_hash: ipHash, p_events: events }); if (error) throw error; return Array.isArray(data) ? data.filter((item): item is string => typeof item === "string") : []; },
  }, await sha256(`${salt}:${forwarded}`));
  return withCors(request, response);
});
