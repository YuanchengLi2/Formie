import { subscriptionTestControlsHandler } from "./handler";

const request = (action: string) => new Request("https://edge.test/subscription-test-controls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
const commandRequest = (body: unknown) => new Request("https://edge.test/subscription-test-controls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("subscriptionTestControlsHandler", () => {
  it("rejects controls when the server flag is disabled", async () => {
    const response = await subscriptionTestControlsHandler(request("uncancel"), { enabled: () => false } as never);
    expect(response.status).toBe(404);
  });

  it("rejects unsupported actions", async () => {
    const response = await subscriptionTestControlsHandler(request("grant_forever"), { enabled: () => true } as never);
    expect(response.status).toBe(400);
  });

  it("requires a sandbox Test Store subscription", async () => {
    const deps = { enabled: () => true, authenticate: jest.fn().mockResolvedValue("u1"), loadCurrent: jest.fn().mockResolvedValue({ sandbox: false, store: "app_store" }), apply: jest.fn() };
    const response = await subscriptionTestControlsHandler(request("cancel_at_period_end"), deps);
    expect(response.status).toBe(403);
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it("applies undo-cancellation only to the authenticated test subscriber", async () => {
    const deps = { enabled: () => true, authenticate: jest.fn().mockResolvedValue("u1"), loadCurrent: jest.fn().mockResolvedValue({ sandbox: true, store: "test_store" }), apply: jest.fn().mockResolvedValue({ lifecycle_state: "active_renewing", will_renew: true }) };
    const response = await subscriptionTestControlsHandler(request("uncancel"), deps);
    expect(response.status).toBe(200);
    expect(deps.apply).toHaveBeenCalledWith("u1", { action: "uncancel" });
    await expect(response.json()).resolves.toMatchObject({ lifecycle_state: "active_renewing", will_renew: true });
  });

  it("accepts a validated remaining balance including zero", async () => {
    const deps = { enabled: () => true, authenticate: jest.fn().mockResolvedValue("u1"), loadCurrent: jest.fn().mockResolvedValue({ sandbox: true, store: "test_store" }), apply: jest.fn().mockResolvedValue({ remaining: 0 }) };
    const response = await subscriptionTestControlsHandler(commandRequest({ action: "set_remaining", remaining: 0 }), deps);
    expect(response.status).toBe(200);
    expect(deps.apply).toHaveBeenCalledWith("u1", { action: "set_remaining", remaining: 0 });
  });

  it("lets an Apple sandbox subscriber set the remaining analysis balance", async () => {
    const deps = { enabled: () => true, authenticate: jest.fn().mockResolvedValue("u1"), loadCurrent: jest.fn().mockResolvedValue({ sandbox: true, store: "app_store" }), apply: jest.fn().mockResolvedValue({ remaining: 7 }) };
    const response = await subscriptionTestControlsHandler(commandRequest({ action: "set_remaining", remaining: 7 }), deps);
    expect(response.status).toBe(200);
    expect(deps.apply).toHaveBeenCalledWith("u1", { action: "set_remaining", remaining: 7 });
  });

  it("keeps lifecycle simulation unavailable for Apple sandbox subscriptions", async () => {
    const deps = { enabled: () => true, authenticate: jest.fn().mockResolvedValue("u1"), loadCurrent: jest.fn().mockResolvedValue({ sandbox: true, store: "app_store" }), apply: jest.fn() };
    const response = await subscriptionTestControlsHandler(request("renew_now"), deps);
    expect(response.status).toBe(403);
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it("rejects invalid balances and extra command fields", async () => {
    const deps = { enabled: () => true, authenticate: jest.fn().mockResolvedValue("u1"), loadCurrent: jest.fn().mockResolvedValue({ sandbox: true, store: "test_store" }), apply: jest.fn() };
    expect((await subscriptionTestControlsHandler(commandRequest({ action: "set_remaining", remaining: 11 }), deps)).status).toBe(400);
    expect((await subscriptionTestControlsHandler(commandRequest({ action: "set_remaining", remaining: 2, extra: true }), deps)).status).toBe(400);
    expect(deps.apply).not.toHaveBeenCalled();
  });
});
