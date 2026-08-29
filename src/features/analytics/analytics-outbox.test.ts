import { AnalyticsOutbox, type AnalyticsOutboxStorage } from "./analytics-outbox";
import type { AnalyticsEventInput } from "./product-analytics";

const makeEvent = (index: number, occurredAt = new Date().toISOString()): AnalyticsEventInput => ({ clientEventId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, eventName: "app_session_started", occurredAt, anonymousId: "00000000-0000-4000-8000-000000000001", appSessionId: "00000000-0000-4000-8000-000000000002" });

describe("analytics outbox", () => {
  it("persists, sends batches of 25, and deletes only acknowledged ids", async () => {
    let persisted: AnalyticsEventInput[] = []; const storage: AnalyticsOutboxStorage = { load: async () => persisted, save: async (events) => { persisted = events; } };
    const send = jest.fn(async (events: AnalyticsEventInput[]) => ({ acceptedEventIds: events.slice(0, 20).map((item) => item.clientEventId) }));
    const outbox = new AnalyticsOutbox(storage, send);
    for (let index = 1; index <= 30; index += 1) await outbox.enqueue(makeEvent(index), false);
    await outbox.flush();
    expect(send.mock.calls[0]![0][0]!.clientEventId).toBe(makeEvent(1).clientEventId);
    expect(send.mock.calls[0]![0]).toHaveLength(25);
    expect(persisted).toHaveLength(10);
  });

  it("caps the queue at 500, removes events older than seven days, and preserves events on failure", async () => {
    let persisted: AnalyticsEventInput[] = []; const storage: AnalyticsOutboxStorage = { load: async () => persisted, save: async (events) => { persisted = events; } };
    const outbox = new AnalyticsOutbox(storage, async () => { throw new Error("offline"); }, () => new Date("2026-08-29T12:00:00Z").getTime());
    await outbox.enqueue(makeEvent(999, "2026-08-20T00:00:00Z"), false);
    for (let index = 1; index <= 510; index += 1) await outbox.enqueue(makeEvent(index, "2026-08-29T11:00:00Z"), false);
    await expect(outbox.flush()).resolves.toBe(false);
    expect(persisted).toHaveLength(500);
  });
});
