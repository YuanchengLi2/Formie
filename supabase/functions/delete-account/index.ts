import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { deleteAccountHandler } from "./handler.ts";
import { listUserObjectPaths, removeUserObjects } from "./storage.ts";

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["DELETE", "POST"], authentication: "user", maxBodyBytes: 4_096 });
  if (security) return security;

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

  return withCors(request, response);
});
