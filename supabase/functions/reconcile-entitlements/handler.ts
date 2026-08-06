import type { RevenueCatSubscriber } from "../_shared/revenuecat.ts";

export type ReconcileEntitlementsDependencies = {
  authenticateCron: (request: Request) => boolean;
  listUsers: (options: { offset: number; limit: number }) => Promise<{ users: string[]; hasMore: boolean; nextOffset: number | null }>;
  loadSubscriber: (appUserId: string) => Promise<RevenueCatSubscriber>;
  saveSubscriber: (userId: string, subscriber: RevenueCatSubscriber) => Promise<{ status: "active" | "expired" } | null>;
  releaseStaleReservations: () => Promise<number>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

export async function reconcileEntitlementsHandler(request: Request, dependencies: ReconcileEntitlementsDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  if (!dependencies.authenticateCron(request)) return json({ message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  const url = new URL(request.url);
  const requestedOffset = Number(url.searchParams.get("offset") ?? 0);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 500);
  const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;
  const limit = Number.isInteger(requestedLimit) ? Math.min(500, Math.max(1, requestedLimit)) : 500;
  const batch = await dependencies.listUsers({ offset, limit });
  let reconciled = 0;
  let updated = 0;
  let expired = 0;
  let skipped = 0;
  let failed = 0;
  for (const userId of batch.users) {
    try {
      const saved = await dependencies.saveSubscriber(userId, await dependencies.loadSubscriber(userId));
      reconciled += 1;
      if (saved?.status === "active") updated += 1;
      else if (saved?.status === "expired") expired += 1;
      else skipped += 1;
    } catch {
      // One provider failure must not prevent other subscribers from reconciling.
      failed += 1;
    }
  }
  const released = await dependencies.releaseStaleReservations();
  return json({ reconciled, updated, expired, skipped, failed, released, hasMore: batch.hasMore, nextOffset: batch.nextOffset }, 200);
}
