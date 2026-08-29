import { recordProductAnalyticsHandler, type RecordProductAnalyticsDependencies } from "./handler";

const event = {
  clientEventId: "00000000-0000-4000-8000-000000000001",
  eventName: "app_session_started",
  occurredAt: "2026-08-29T12:00:00.000Z",
  anonymousId: "00000000-0000-4000-8000-000000000002",
  appSessionId: "00000000-0000-4000-8000-000000000003",
  properties: { platform: "ios" },
};

function dependencies(overrides: Partial<RecordProductAnalyticsDependencies> = {}): RecordProductAnalyticsDependencies {
  return {
    resolveUserId: jest.fn(async () => null),
    ingest: jest.fn(async ({ events }) => events.map((item) => item.clientEventId)),
    ...overrides,
  };
}

describe("record product analytics handler", () => {
  it("accepts a privacy-safe anonymous batch and returns acknowledged ids", async () => {
    const deps = dependencies();
    const response = await recordProductAnalyticsHandler(new Request("https://example.test", { method: "POST", body: JSON.stringify({ events: [event] }) }), deps, "ip-hash");
    expect(response.status).toBe(200);
    expect(deps.ingest).toHaveBeenCalledWith(expect.objectContaining({ userId: null, ipHash: "ip-hash", events: [event] }));
    await expect(response.json()).resolves.toEqual({ acceptedEventIds: [event.clientEventId] });
  });

  it("rejects batches over 25 and unknown event names", async () => {
    const deps = dependencies();
    const tooMany = await recordProductAnalyticsHandler(new Request("https://example.test", { method: "POST", body: JSON.stringify({ events: Array.from({ length: 26 }, () => event) }) }), deps, "ip-hash");
    expect(tooMany.status).toBe(400);
    const invalid = await recordProductAnalyticsHandler(new Request("https://example.test", { method: "POST", body: JSON.stringify({ events: [{ ...event, eventName: "raw_video_uploaded" }] }) }), deps, "ip-hash");
    expect(invalid.status).toBe(400);
    expect(deps.ingest).not.toHaveBeenCalled();
  });

  it("rejects malformed ids, nested values, unknown keys, and prohibited text", async () => {
    for (const badEvent of [
      { ...event, anonymousId: "device-fingerprint" },
      { ...event, properties: { platform: { name: "ios" } } },
      { ...event, properties: { email: "person@example.com" } },
      { ...event, properties: { platform: "person@example.com" } },
    ]) {
      const response = await recordProductAnalyticsHandler(new Request("https://example.test", { method: "POST", body: JSON.stringify({ events: [badEvent] }) }), dependencies(), "ip-hash");
      expect(response.status).toBe(400);
    }
  });

  it("allows an optional authenticated identity without requiring one", async () => {
    const deps = dependencies({ resolveUserId: jest.fn(async () => "user-123") });
    const response = await recordProductAnalyticsHandler(new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer token" }, body: JSON.stringify({ events: [event] }) }), deps, "ip-hash");
    expect(response.status).toBe(200);
    expect(deps.ingest).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-123" }));
  });
});
