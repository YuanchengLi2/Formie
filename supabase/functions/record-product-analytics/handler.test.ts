import { recordProductAnalyticsHandler, type AnalyticsDependencies } from "./handler";

const anonymousId = "3b7fb2b6-172f-4aef-bc66-caf8f9177dc0";
const eventId = "5a6c17b7-a34e-42f6-99a5-1b0a8d3b28c9";
const installationSecret = "abcdefghijklmnopqrstuvwxyzABCDEF";

function request(body: unknown, authorization?: string) {
  return new Request("https://example.test/functions/v1/record-product-analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify(body),
  });
}

function body(properties: Record<string, unknown> = {}) {
  return { anonymousId, installationSecret, events: [{ clientEventId: eventId, eventName: "app_session_started", occurredAt: "2026-09-05T00:00:00.000Z", appSessionId: "3a9ade36-ef48-4ee4-8429-86a3403c16e9", properties }] };
}

function dependencies(overrides: Partial<AnalyticsDependencies> = {}): AnalyticsDependencies {
  return {
    authenticateOptional: jest.fn(async () => null),
    ingest: jest.fn(async ({ events }) => events.map((event) => event.clientEventId)),
    ...overrides,
  };
}

describe("recordProductAnalyticsHandler", () => {
  it("accepts anonymous batches with an installation proof", async () => {
    const deps = dependencies();
    const response = await recordProductAnalyticsHandler(request(body()), deps);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: [eventId] });
    expect(deps.ingest).toHaveBeenCalledWith(expect.objectContaining({ userId: null, anonymousId, installationSecret }));
  });

  it("passes only a verified authenticated identity into ingestion", async () => {
    const deps = dependencies({ authenticateOptional: jest.fn(async () => "user-1") });
    await recordProductAnalyticsHandler(request(body(), "Bearer verified"), deps);
    expect(deps.ingest).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
  });

  it("rejects a forged or invalid bearer session", async () => {
    const response = await recordProductAnalyticsHandler(request(body(), "Bearer forged"), dependencies({ authenticateOptional: jest.fn(async () => { throw new Error("UNAUTHORIZED"); }) }));
    expect(response.status).toBe(401);
  });

  it("rejects unexpected top-level identity fields", async () => {
    const response = await recordProductAnalyticsHandler(request({ ...body(), userId: "victim" }), dependencies());
    expect(response.status).toBe(400);
  });

  it("maps installation ownership mismatches and invalid event schemas to a bounded client error", async () => {
    const response = await recordProductAnalyticsHandler(request(body({ secret: "not allowed" })), dependencies({ ingest: jest.fn(async () => { throw new Error("INSTALLATION_OWNER_MISMATCH"); }) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INSTALLATION_OWNER_MISMATCH" });
  });

  it("returns only acknowledged event IDs for partial batch delivery", async () => {
    const secondId = "2d66bc80-c4bf-4a14-9d2c-e21d5b6352a0";
    const payload = body();
    payload.events.push({ ...payload.events[0], clientEventId: secondId });
    const response = await recordProductAnalyticsHandler(request(payload), dependencies({ ingest: jest.fn(async () => [eventId]) }));
    expect(await response.json()).toEqual({ accepted: [eventId] });
  });

  it("makes rate limits retryable and temporary backend failures unavailable", async () => {
    const limited = await recordProductAnalyticsHandler(request(body()), dependencies({ ingest: jest.fn(async () => { throw new Error("RATE_LIMIT_EXCEEDED"); }) }));
    const unavailable = await recordProductAnalyticsHandler(request(body()), dependencies({ ingest: jest.fn(async () => { throw new Error("database offline"); }) }));
    expect(limited.status).toBe(429);
    expect(unavailable.status).toBe(503);
  });
});
