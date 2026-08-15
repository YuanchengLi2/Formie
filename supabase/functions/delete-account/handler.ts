import { accountStorageBuckets, type AccountStorageBucket } from "./storage";

export type DeleteAccountStage = "storage" | "analytics" | "auth_user";

export type AccountDeletionDependencies = {
  authenticate(request: Request): Promise<string>;
  listUserFiles(bucket: AccountStorageBucket, userId: string): Promise<string[]>;
  removeFiles(bucket: AccountStorageBucket, userId: string, paths: string[]): Promise<void>;
  deleteAnalytics(userId: string): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function validConfirmation(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.length === 1 && keys[0] === "confirmation" && record.confirmation === "DELETE";
}

export async function deleteAccountHandler(request: Request, dependencies: AccountDeletionDependencies): Promise<Response> {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (!validConfirmation(body)) {
    return json({ message: "Type DELETE to confirm account deletion", code: "INVALID_BODY" }, 400);
  }

  let userId: string;
  try {
    userId = await dependencies.authenticate(request);
  } catch {
    return json({ message: "Sign in again before deleting your account", code: "UNAUTHORIZED" }, 401);
  }

  try {
    for (const bucket of accountStorageBuckets) {
      const paths = await dependencies.listUserFiles(bucket, userId);
      if (paths.length > 0) await dependencies.removeFiles(bucket, userId, paths);
    }
  } catch {
    return json({ message: "Your stored files could not be deleted. Try again.", code: "STORAGE_DELETE_FAILED", stage: "storage" }, 500);
  }

  try {
    await dependencies.deleteAnalytics(userId);
  } catch {
    return json({ message: "Your account data could not be deleted. Try again.", code: "ANALYTICS_DELETE_FAILED", stage: "analytics" }, 500);
  }

  try {
    await dependencies.deleteAuthUser(userId);
  } catch {
    return json({ message: "Your account could not be deleted. Try again.", code: "AUTH_USER_DELETE_FAILED", stage: "auth_user" }, 500);
  }

  return json({ deleted: true }, 200);
}
