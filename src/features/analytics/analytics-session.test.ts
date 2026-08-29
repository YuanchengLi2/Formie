import { AnalyticsSessionManager } from "./analytics-session";

describe("analytics session manager", () => {
  it("persists an anonymous id, rotates it on account change, and expires app sessions after 30 minutes", async () => {
    const storage = new Map<string, string>(); let now = 0; let sequence = 0;
    const manager = new AnalyticsSessionManager({ get: async (key) => storage.get(key) ?? null, set: async (key, value) => { storage.set(key, value); }, uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`, now: () => now });
    const first = await manager.initialize(null);
    expect((await manager.initialize(null)).anonymousId).toBe(first.anonymousId);
    now += 29 * 60_000; expect(manager.activate()).toBe(first.appSessionId);
    manager.background(); now += 31 * 60_000; expect(manager.activate()).not.toBe(first.appSessionId);
    const rotated = await manager.accountChanged("user-1"); expect(rotated).not.toBe(first.anonymousId);
    expect(await manager.accountChanged("user-1")).toBe(rotated);
  });
});
