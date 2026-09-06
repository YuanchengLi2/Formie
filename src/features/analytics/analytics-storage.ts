export type AnalyticsStorage = {
  readIdentity: () => Promise<string | null>;
  writeIdentity: (value: string) => Promise<void>;
  readQueue: () => Promise<string | null>;
  writeQueue: (value: string) => Promise<void>;
};

const values = new Map<string, string>();
function storage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export const analyticsStorage: AnalyticsStorage = {
  readIdentity: async () => storage()?.getItem("formie.analytics.identity.v3") ?? values.get("identity") ?? null,
  writeIdentity: async (value) => { storage()?.setItem("formie.analytics.identity.v3", value); values.set("identity", value); },
  readQueue: async () => storage()?.getItem("formie.analytics.queue.v3") ?? values.get("queue") ?? null,
  writeQueue: async (value) => { storage()?.setItem("formie.analytics.queue.v3", value); values.set("queue", value); },
};
