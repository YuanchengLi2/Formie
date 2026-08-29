import * as FileSystem from "expo-file-system/legacy";
import type { AnalyticsEventInput } from "./product-analytics";

export type AnalyticsOutboxStorage = { load: () => Promise<AnalyticsEventInput[]>; save: (events: AnalyticsEventInput[]) => Promise<void> };
export type AnalyticsSender = (events: AnalyticsEventInput[]) => Promise<{ acceptedEventIds: string[] }>;
const MAX_EVENTS = 500; const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const fileUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}formie-product-analytics-v2.json`;
export const fileAnalyticsOutboxStorage: AnalyticsOutboxStorage = {
  load: async () => { try { const text = await FileSystem.readAsStringAsync(fileUri); const value: unknown = JSON.parse(text); return Array.isArray(value) ? value as AnalyticsEventInput[] : []; } catch { return []; } },
  save: async (events) => { await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(events)); },
};

export class AnalyticsOutbox {
  private operation = Promise.resolve();
  constructor(private readonly storage: AnalyticsOutboxStorage, private readonly send: AnalyticsSender, private readonly now: () => number = Date.now) {}
  private serialize<T>(action: () => Promise<T>): Promise<T> { const next = this.operation.then(action, action); this.operation = next.then(() => undefined, () => undefined); return next; }
  private bounded(events: AnalyticsEventInput[]): AnalyticsEventInput[] { const cutoff = this.now() - MAX_AGE_MS; return events.filter((item) => Date.parse(item.occurredAt) >= cutoff).slice(-MAX_EVENTS); }
  enqueue(event: AnalyticsEventInput, flush = true): Promise<void> { return this.serialize(async () => { const events = this.bounded([...(await this.storage.load()), event]); await this.storage.save(events); if (flush) void this.flush(); }); }
  flush(): Promise<boolean> { return this.serialize(async () => {
    const queued = this.bounded(await this.storage.load()); await this.storage.save(queued); if (!queued.length) return true;
    try { const batch = queued.slice(0, 25); const response = await this.send(batch); const accepted = new Set(response.acceptedEventIds); await this.storage.save(queued.filter((item) => !accepted.has(item.clientEventId))); return true; } catch { return false; }
  }); }
  count(): Promise<number> { return this.serialize(async () => this.bounded(await this.storage.load()).length); }
}
