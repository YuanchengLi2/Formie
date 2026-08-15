import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { deleteAccountHandler } from "./handler.ts";
import { listUserObjectPaths, removeUserObjects } from "./storage.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  const admin = createAdminClient();
  const response = await deleteAccountHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    listUserFiles: (bucket, userId) => listUserObjectPaths(
      bucket,
      userId,
      async (selectedBucket, prefix, offset, limit) => {
        const { data, error } = await admin.storage.from(selectedBucket).list(prefix, {
          limit,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error) throw error;
        return (data ?? []).map((entry) => ({
          name: entry.name,
          id: entry.id ?? null,
          metadata: entry.metadata ?? null,
        }));
      },
    ),
    removeFiles: (bucket, userId, paths) => removeUserObjects(
      bucket,
      userId,
      paths,
      async (selectedBucket, batch) => {
        const { error } = await admin.storage.from(selectedBucket).remove(batch);
        if (error) throw error;
      },
    ),
    deleteAnalytics: async (userId) => {
      const { error } = await admin.from("product_analytics_events").delete().eq("user_id", userId);
      if (error) throw error;
    },
    deleteAuthUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId, false);
      if (error) throw error;
    },
  });

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
