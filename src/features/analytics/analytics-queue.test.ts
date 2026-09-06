import { AnalyticsQueue } from "./analytics-queue";
import type { AnalyticsStorage } from "./analytics-storage";

function memoryStorage(seed: { identity?: string; queue?: string } = {}) {
  const values = { identity: seed.identity ?? null as string | null, queue: seed.queue ?? null as string | null };
  const storage: AnalyticsStorage = {
    readIdentity: async () => values.identity,
    writeIdentity: async (value) => { values.identity = value; },
    readQueue: async () => values.queue,
    writeQueue: async (value) => { values.queue = value; },
  };
  return { storage, values };
}

describe("AnalyticsQueue", () => {
  it("keeps stable event IDs offline and removes only acknowledged events", async () => {
    const firstStore = memoryStorage();
    const unavailable = jest.fn(async () => ({ data: null, error: { message: "offline" } }));
    const first = new AnalyticsQueue(firstStore.storage, unavailable);
    await first.enqueue("paywall_viewed", { offerId: "monthly" });
    const original = JSON.parse(firstStore.values.queue ?? "[]") as { clientEventId: string }[];
    await expect(first.flush()).rejects.toEqual({ message: "offline" });
    expect(JSON.parse(firstStore.values.queue ?? "[]")[0].clientEventId).toBe(original[0].clientEventId);

    const delivered = jest.fn(async () => ({ data: { accepted: [original[0].clientEventId] }, error: null }));
    const restarted = new AnalyticsQueue(firstStore.storage, delivered);
    await restarted.flush();
    expect(JSON.parse(firstStore.values.queue ?? "[]")).toEqual([]);
  });

  it("links anonymous events on first login and clears queued identity on account switching", async () => {
    const state = memoryStorage();
    const deliveries: Record<string, unknown>[] = [];
    const queue = new AnalyticsQueue(state.storage, async (body) => { deliveries.push(body); return { data: { accepted: [] }, error: null }; });
    await queue.enqueue("onboarding_screen_viewed", { step: "welcome" });
    await queue.setAccount("user-a");
    await queue.flush();
    expect((deliveries[0].events as Record<string, unknown>[])).toHaveLength(1);
    await queue.enqueue("account_created", { onboardingVersion: "approved-v1" });
    await queue.setAccount("user-b");
    expect(JSON.parse(state.values.queue ?? "[]")).toEqual([]);
    expect((JSON.parse(state.values.identity ?? "{}") as { accountId: string }).accountId).toBe("user-b");
  });

  it("bounds persisted events to the newest 200", async () => {
    const state = memoryStorage();
    const queue = new AnalyticsQueue(state.storage, async () => ({ data: { accepted: [] }, error: null }));
    for (let index = 0; index < 205; index += 1) await queue.enqueue("onboarding_cta_pressed", { step: String(index) });
    const events = JSON.parse(state.values.queue ?? "[]") as { properties: { step: string } }[];
    expect(events).toHaveLength(200);
    expect(events[0].properties.step).toBe("5");
  });

  it("delivers an event shortly after enqueue without another lifecycle transition", async () => {
    jest.useFakeTimers();
    try {
      const state = memoryStorage();
      const deliveries: Record<string, unknown>[] = [];
      const queue = new AnalyticsQueue(state.storage, async (body) => {
        deliveries.push(body);
        const events = body.events as { clientEventId: string }[];
        return { data: { accepted: events.map((event) => event.clientEventId) }, error: null };
      });

      await queue.enqueue("exercise_selected", { exerciseId: "squat" });
      expect(deliveries).toHaveLength(0);
      await jest.advanceTimersByTimeAsync(300);

      expect(deliveries).toHaveLength(1);
      expect(JSON.parse(state.values.queue ?? "[]")).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("drains every acknowledged batch instead of stopping after 25 events", async () => {
    jest.useFakeTimers();
    try {
      const state = memoryStorage();
      const batchSizes: number[] = [];
      const queue = new AnalyticsQueue(state.storage, async (body) => {
        const events = body.events as { clientEventId: string }[];
        batchSizes.push(events.length);
        return { data: { accepted: events.map((event) => event.clientEventId) }, error: null };
      });
      for (let index = 0; index < 30; index += 1) await queue.enqueue("onboarding_cta_pressed", { step: String(index) });

      await jest.advanceTimersByTimeAsync(300);

      expect(batchSizes).toEqual([25, 5]);
      expect(JSON.parse(state.values.queue ?? "[]")).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });
});
