import { refreshEntitlement } from "./api";

const mockInvoke = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

describe("billing entitlement refresh", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ data: { access: { status: "active" }, source: "revenuecat" }, error: null });
  });

  it("sends no client entitlement assertions to the server", async () => {
    await refreshEntitlement("jwt");

    expect(mockInvoke).toHaveBeenCalledWith("refresh-entitlement", {
      headers: { Authorization: "Bearer jwt" },
    });
  });
});
