import { createAdminClient } from "../_shared/auth.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { recordProductAnalyticsHandler } from "./handler.ts";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["POST"], authentication: "optional", maxBodyBytes: 65_536 });
  if (security) return security;
  const admin = createAdminClient();
  const response = await recordProductAnalyticsHandler(request, {
    authenticateOptional: async (incoming) => {
      const authorization = incoming.headers.get("Authorization");
      if (!authorization) return null;
      if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
      const { data, error } = await admin.auth.getUser(authorization.slice(7));
      if (error || !data.user) throw new Error("UNAUTHORIZED");
      return data.user.id;
    },
    ingest: async ({ userId, anonymousId, installationSecret, events, request: incoming }) => {
      const forwarded = incoming.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? incoming.headers.get("cf-connecting-ip") ?? "unknown";
      const ipSalt = Deno.env.get("ANALYTICS_IP_HASH_SALT") ?? "";
      if (!ipSalt) throw new Error("ANALYTICS_IP_HASH_SALT is not configured");
      const { data, error } = await admin.rpc("ingest_product_analytics_v3", {
        p_user_id: userId,
        p_ip_hash: await sha256(`${ipSalt}:${forwarded}`),
        p_anonymous_id: anonymousId,
        p_installation_secret_hash: await sha256(installationSecret),
        p_events: events,
      });
      if (error) throw error;
      return Array.isArray(data) ? data.filter((item): item is string => typeof item === "string") : [];
    },
  });
  return withCors(request, response);
});
