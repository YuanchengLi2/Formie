jest.mock("npm:@supabase/supabase-js@2.110.5", () => ({ createClient: jest.fn() }), { virtual: true });

import { requireUser } from "./auth";

describe("requireUser", () => {
  it("returns verified identity and a caller-scoped client", async () => {
    const admin = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "u1", email: "u@example.com" } }, error: null }) } };
    const caller = { rpc: jest.fn() };
    const createCaller = jest.fn().mockReturnValue(caller);
    await expect(requireUser(new Request("https://edge.test", { headers: { Authorization: "Bearer jwt" } }), admin as never, createCaller as never)).resolves.toEqual({ id: "u1", email: "u@example.com", client: caller });
    expect(createCaller).toHaveBeenCalledWith("jwt");
  });

  it.each([null, "Basic nope"])("rejects missing bearer auth", async (authorization) => {
    const headers = authorization ? { Authorization: authorization } : undefined;
    await expect(requireUser(new Request("https://edge.test", { headers }))).rejects.toThrow("UNAUTHORIZED");
  });

  it("rejects a deleted user", async () => {
    const admin = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { status: 401 } }) } };
    await expect(requireUser(new Request("https://edge.test", { headers: { Authorization: "Bearer jwt" } }), admin as never)).rejects.toThrow("UNAUTHORIZED");
  });
});
