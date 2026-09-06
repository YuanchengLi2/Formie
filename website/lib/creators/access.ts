import { redirect } from "next/navigation";
import { createCookieClient } from "@/lib/admin/supabase-runtime";

export class CreatorAccessError extends Error {}

export async function verifyCreator(client: Awaited<ReturnType<typeof createCookieClient>>) {
  const { data, error } = await client.auth.getUser();
  if (error) {
    if ([400, 401, 403].includes(error.status ?? 0) || error.name === "AuthSessionMissingError") {
      throw new CreatorAccessError("Creator authentication required");
    }
    // A service outage does not prove that a signed-in creator lost access.
    throw error;
  }
  if (!data.user) throw new CreatorAccessError("Creator authentication required");
  const { data: memberships, error: membershipError } = await client.rpc("get_my_creator_membership");
  if (membershipError) throw membershipError;
  const membership = Array.isArray(memberships) ? memberships[0] : memberships;
  if (!membership || membership.status !== "active") throw new CreatorAccessError("Creator access required");
  return { client, user: data.user, creatorId: String(membership.creator_id) };
}

export async function requireCreator() {
  return verifyCreator(await createCookieClient());
}

export function redirectCreatorLogin(error: unknown): never {
  if (error instanceof CreatorAccessError) redirect("/creators/login");
  throw error;
}
