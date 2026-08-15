import { accountStorageBuckets, type AccountStorageBucket } from "./storage";
import { deleteAccountHandler, type AccountDeletionDependencies } from "./handler";

function request(body: unknown = { confirmation: "DELETE" }, method = "POST") {
  return new Request("https://example.test/delete-account", {
    method,
    headers: { Authorization: "Bearer secret-token", "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function dependencies(overrides: Partial<AccountDeletionDependencies> = {}): AccountDeletionDependencies {
  return {
    authenticate: async () => "user-1",
    listUserFiles: async (bucket) => [`user-1/${bucket}/file.bin`],
    removeFiles: async () => undefined,
    deleteAnalytics: async () => undefined,
    deleteAuthUser: async () => undefined,
    ...overrides,
  };
}

describe("delete account handler", () => {
  it("deletes both storage buckets, linked analytics, and the Auth user in order", async () => {
    const events: string[] = [];
    const response = await deleteAccountHandler(request(), dependencies({
      authenticate: async () => { events.push("authenticate"); return "user-1"; },
      listUserFiles: async (bucket) => { events.push(`list:${bucket}`); return [`user-1/${bucket}/file.bin`]; },
      removeFiles: async (bucket, userId, paths) => {
        expect(userId).toBe("user-1");
        expect(paths).toEqual([`user-1/${bucket}/file.bin`]);
        events.push(`remove:${bucket}`);
      },
      deleteAnalytics: async () => { events.push("delete:analytics"); },
      deleteAuthUser: async () => { events.push("delete:auth_user"); },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(events).toEqual([
      "authenticate",
      "list:analysis-videos",
      "remove:analysis-videos",
      "list:analysis-artifacts",
      "remove:analysis-artifacts",
      "delete:analytics",
      "delete:auth_user",
    ]);
  });

  it("rejects unsupported methods before authentication", async () => {
    const authenticate = jest.fn();
    const response = await deleteAccountHandler(request(undefined, "GET"), dependencies({ authenticate }));
    expect(response.status).toBe(405);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    { confirmation: "delete" },
    { confirmation: "DELETE", userId: "other-user" },
  ])("rejects invalid or identity-bearing body %p", async (body) => {
    const authenticate = jest.fn();
    const response = await deleteAccountHandler(request(body), dependencies({ authenticate }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Type DELETE to confirm account deletion", code: "INVALID_BODY" });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("rejects unauthorized callers without privileged operations", async () => {
    const listUserFiles = jest.fn();
    const deleteAuthUser = jest.fn();
    const response = await deleteAccountHandler(request(), dependencies({
      authenticate: async () => { throw new Error("UNAUTHORIZED"); },
      listUserFiles,
      deleteAuthUser,
    }));
    expect(response.status).toBe(401);
    expect(listUserFiles).not.toHaveBeenCalled();
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("treats already-empty storage as idempotent progress", async () => {
    const removed: AccountStorageBucket[] = [];
    const deleteAuthUser = jest.fn().mockResolvedValue(undefined);
    const response = await deleteAccountHandler(request(), dependencies({
      listUserFiles: async () => [],
      removeFiles: async (bucket) => { removed.push(bucket); },
      deleteAuthUser,
    }));
    expect(response.status).toBe(200);
    expect(removed).toEqual([]);
    expect(deleteAuthUser).toHaveBeenCalledWith("user-1");
  });

  it.each(accountStorageBuckets)("stops before database/Auth deletion when %s storage fails", async (failedBucket) => {
    const deleteAnalytics = jest.fn();
    const deleteAuthUser = jest.fn();
    const response = await deleteAccountHandler(request(), dependencies({
      listUserFiles: async (bucket) => {
        if (bucket === failedBucket) throw new Error(`private path user-1/${bucket}/secret`);
        return [];
      },
      deleteAnalytics,
      deleteAuthUser,
    }));
    const body = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(body)).toEqual({ message: "Your stored files could not be deleted. Try again.", code: "STORAGE_DELETE_FAILED", stage: "storage" });
    expect(body).not.toMatch(/secret-token|user-1|private path/);
    expect(deleteAnalytics).not.toHaveBeenCalled();
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("does not delete the Auth user when analytics deletion fails", async () => {
    const deleteAuthUser = jest.fn();
    const response = await deleteAccountHandler(request(), dependencies({
      listUserFiles: async () => [],
      deleteAnalytics: async () => { throw new Error("email@example.com"); },
      deleteAuthUser,
    }));
    const body = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(body)).toEqual({ message: "Your account data could not be deleted. Try again.", code: "ANALYTICS_DELETE_FAILED", stage: "analytics" });
    expect(body).not.toContain("email@example.com");
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("reports Auth deletion failure without leaking provider details", async () => {
    const response = await deleteAccountHandler(request(), dependencies({
      listUserFiles: async () => [],
      deleteAuthUser: async () => { throw new Error("provider user user-1 failed"); },
    }));
    const body = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(body)).toEqual({ message: "Your account could not be deleted. Try again.", code: "AUTH_USER_DELETE_FAILED", stage: "auth_user" });
    expect(body).not.toContain("user-1");
  });
});
