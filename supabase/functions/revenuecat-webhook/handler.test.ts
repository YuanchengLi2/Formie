import { revenueCatWebhookHandler } from "./handler";

const request = (body: unknown, token = "secret") => new Request("https://edge.test/revenuecat-webhook", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("revenueCatWebhookHandler", () => {
  const event = { event: { id: "evt-1", type: "RENEWAL", app_user_id: "8e6dbfc0-23c9-4a8a-a232-273c4f48c161", aliases: [] } };

  it("rejects an invalid webhook secret", async () => {
    const response = await revenueCatWebhookHandler(request(event, "wrong"), {} as never, "secret");
    expect(response.status).toBe(401);
  });

  it("fetches current subscriber state and persists it once", async () => {
    const dependencies = {
      claimEvent: jest.fn().mockResolvedValue("claimed"),
      resolveUserId: jest.fn().mockResolvedValue("8e6dbfc0-23c9-4a8a-a232-273c4f48c161"),
      applyEvent: jest.fn().mockResolvedValue(undefined),
      loadSubscriber: jest.fn().mockResolvedValue({ appUserId: "8e6dbfc0-23c9-4a8a-a232-273c4f48c161", entitlements: [] }),
      saveSubscriber: jest.fn().mockResolvedValue(undefined),
      completeEvent: jest.fn().mockResolvedValue(undefined),
      failEvent: jest.fn().mockResolvedValue(undefined),
    };
    const response = await revenueCatWebhookHandler(request(event), dependencies, "secret");
    expect(response.status).toBe(200);
    expect(dependencies.loadSubscriber).toHaveBeenCalledWith("8e6dbfc0-23c9-4a8a-a232-273c4f48c161");
    expect(dependencies.applyEvent).toHaveBeenCalledWith("8e6dbfc0-23c9-4a8a-a232-273c4f48c161", expect.objectContaining({ id: "evt-1", type: "RENEWAL" }));
    expect(dependencies.applyEvent.mock.invocationCallOrder[0]).toBeLessThan(dependencies.loadSubscriber.mock.invocationCallOrder[0]);
    expect(dependencies.saveSubscriber).toHaveBeenCalledTimes(1);
    expect(dependencies.completeEvent).toHaveBeenCalledWith("evt-1");
  });

  it("parses cancellation and uncancellation transaction fields before subscriber reconciliation", async () => {
    const dependencies = {
      claimEvent: jest.fn().mockResolvedValue("claimed"), resolveUserId: jest.fn().mockResolvedValue("8e6dbfc0-23c9-4a8a-a232-273c4f48c161"),
      applyEvent: jest.fn().mockResolvedValue(undefined), loadSubscriber: jest.fn().mockResolvedValue({ appUserId: "u1", entitlements: [] }), saveSubscriber: jest.fn(), completeEvent: jest.fn(), failEvent: jest.fn(),
    };
    const response = await revenueCatWebhookHandler(request({ event: { ...event.event, id: "uncancel", type: "UNCANCELLATION", product_id: "formie_monthly", purchased_at_ms: 1786058836000, expiration_at_ms: 1786059136000, event_timestamp_ms: 1786058896000, entitlement_ids: ["formie_pro"], environment: "SANDBOX" } }), dependencies as never, "secret");
    expect(response.status).toBe(200);
    expect(dependencies.applyEvent).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      type: "UNCANCELLATION",
      product_identifier: "formie_monthly",
      environment: "SANDBOX",
      entitlement_ids: ["formie_pro"],
      purchased_at: new Date(1786058836000).toISOString(),
      expiration_at: new Date(1786059136000).toISOString(),
      event_timestamp: new Date(1786058896000).toISOString(),
    }));
  });

  it("returns success without reprocessing a completed duplicate", async () => {
    const dependencies = { claimEvent: jest.fn().mockResolvedValue("completed") };
    const response = await revenueCatWebhookHandler(request(event), dependencies as never, "secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ duplicate: true });
  });

  it("rejects unsupported event types and malformed environments before claiming", async () => {
    const dependencies = { claimEvent: jest.fn() };
    const invalidType = await revenueCatWebhookHandler(request({ event: { ...event.event, type: "UNKNOWN_EVENT" } }), dependencies as never, "secret");
    const invalidEnvironment = await revenueCatWebhookHandler(request({ event: { ...event.event, environment: "LOCAL" } }), dependencies as never, "secret");
    expect(invalidType.status).toBe(400);
    expect(invalidEnvironment.status).toBe(400);
    expect(dependencies.claimEvent).not.toHaveBeenCalled();
  });

  it("uses transfer aliases to resolve the canonical Supabase identity", async () => {
    const dependencies = {
      claimEvent: jest.fn().mockResolvedValue("claimed"), resolveUserId: jest.fn().mockResolvedValue(null),
      loadSubscriber: jest.fn(), saveSubscriber: jest.fn(), completeEvent: jest.fn().mockResolvedValue(undefined), failEvent: jest.fn(),
    };
    const response = await revenueCatWebhookHandler(request({ event: { ...event.event, type: "TRANSFER", aliases: ["8d4b4da4-f6d7-4fc0-96ec-ae8b20f1340a"] } }), dependencies as never, "secret");
    expect(response.status).toBe(200);
    expect(dependencies.resolveUserId).toHaveBeenCalledWith(event.event.app_user_id, ["8d4b4da4-f6d7-4fc0-96ec-ae8b20f1340a"]);
  });

  it("includes RevenueCat transfer identity arrays when resolving a user", async () => {
    const dependencies = {
      claimEvent: jest.fn().mockResolvedValue("claimed"), resolveUserId: jest.fn().mockResolvedValue(null),
      loadSubscriber: jest.fn(), saveSubscriber: jest.fn(), completeEvent: jest.fn().mockResolvedValue(undefined), failEvent: jest.fn(),
    };
    const response = await revenueCatWebhookHandler(request({ event: {
      ...event.event,
      type: "TRANSFER",
      aliases: ["alias-user"],
      transferred_from: ["old-user"],
      transferred_to: ["new-user"],
    } }), dependencies as never, "secret");
    expect(response.status).toBe(200);
    expect(dependencies.resolveUserId).toHaveBeenCalledWith(event.event.app_user_id, ["alias-user", "old-user", "new-user"]);
  });

  it("accepts RevenueCat test webhook events for deployment verification", async () => {
    const dependencies = {
      claimEvent: jest.fn().mockResolvedValue("claimed"), resolveUserId: jest.fn().mockResolvedValue(null),
      loadSubscriber: jest.fn(), saveSubscriber: jest.fn(), completeEvent: jest.fn().mockResolvedValue(undefined), failEvent: jest.fn(),
    };
    const response = await revenueCatWebhookHandler(request({ event: { ...event.event, type: "TEST" } }), dependencies as never, "secret");
    expect(response.status).toBe(200);
  });
});
