import { deleteAccount } from "./api";

describe("deleteAccount", () => {
  const input = {
    accessToken: "user-jwt",
    baseUrl: "https://example.supabase.co/functions/v1",
  };

  it("requests authenticated permanent deletion without accepting a client user id", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ deleted: true, externalCleanup: "complete" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(deleteAccount({ ...input, fetcher })).resolves.toEqual({ deleted: true, externalCleanup: "complete" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/delete-account",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer user-jwt",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ confirmation: "DELETE" }),
      }),
    );
  });

  it("requires public Supabase configuration", async () => {
    const previous = process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    try {
      await expect(deleteAccount({ accessToken: "jwt", fetcher: jest.fn() })).rejects.toMatchObject({
        code: "MISSING_CONFIGURATION",
        status: 0,
      });
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      else process.env.EXPO_PUBLIC_SUPABASE_URL = previous;
    }
  });

  it("normalizes network failures", async () => {
    const fetcher = jest.fn(async () => { throw new Error("socket detail must not leak"); });
    await expect(deleteAccount({ ...input, fetcher })).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });

  it.each([
    [401, { code: "UNAUTHORIZED", message: "Sign in again before deleting your account" }],
    [500, { code: "STORAGE_DELETE_FAILED", stage: "storage", message: "Your stored files could not be deleted. Try again." }],
  ])("preserves safe server errors for status %i", async (status, payload) => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }));
    await expect(deleteAccount({ ...input, fetcher })).rejects.toMatchObject({ ...payload, status });
  });

  it("rejects a malformed success response", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ deleted: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    await expect(deleteAccount({ ...input, fetcher })).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 200 });
  });

  it("returns queued cleanup honestly without supporting an Apple reauthentication blocker", async () => {
    const queued = jest.fn(async () => new Response(JSON.stringify({ deleted: true, externalCleanup: "queued" }), { status: 200 }));
    await expect(deleteAccount({ ...input, fetcher: queued })).resolves.toEqual({ deleted: true, externalCleanup: "queued" });
    const reauth = jest.fn(async () => new Response(JSON.stringify({ code: "APPLE_REAUTH_REQUIRED", stage: "external", message: "Sign in with Apple again so Formie can revoke authorization before deletion." }), { status: 409 }));
    await expect(deleteAccount({ ...input, fetcher: reauth })).rejects.toMatchObject({ code: "REQUEST_FAILED", status: 409 });
  });
});
