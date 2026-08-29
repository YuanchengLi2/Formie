import * as SecureStore from "expo-secure-store";

type SessionStorage = { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void> };
type SessionDependencies = SessionStorage & { uuid: () => string; now: () => number };
const ANONYMOUS_KEY = "formie.analytics.anonymous-id.v2";
const ACCOUNT_KEY = "formie.analytics.account-id.v2";
const SESSION_TIMEOUT_MS = 30 * 60_000;

export function randomAnalyticsUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return bytes.map((byte, index) => `${index === 4 || index === 6 || index === 8 || index === 10 ? "-" : ""}${byte.toString(16).padStart(2, "0")}`).join("");
}

export class AnalyticsSessionManager {
  private anonymousId = ""; private appSessionId = ""; private backgroundedAt: number | null = null; private accountId: string | null = null;
  constructor(private readonly deps: SessionDependencies = { get: SecureStore.getItemAsync, set: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }), uuid: randomAnalyticsUuid, now: Date.now }) {}
  async initialize(accountId: string | null): Promise<{ anonymousId: string; appSessionId: string }> {
    this.anonymousId = await this.deps.get(ANONYMOUS_KEY) ?? this.deps.uuid(); this.appSessionId ||= this.deps.uuid(); this.accountId = (await this.deps.get(ACCOUNT_KEY)) || null;
    if (!(await this.deps.get(ANONYMOUS_KEY))) await this.deps.set(ANONYMOUS_KEY, this.anonymousId);
    if (accountId !== this.accountId) await this.accountChanged(accountId);
    return this.snapshot();
  }
  snapshot() { return { anonymousId: this.anonymousId, appSessionId: this.appSessionId }; }
  background(): void { this.backgroundedAt = this.deps.now(); }
  activate(): string { if (this.backgroundedAt !== null && this.deps.now() - this.backgroundedAt >= SESSION_TIMEOUT_MS) this.appSessionId = this.deps.uuid(); this.backgroundedAt = null; return this.appSessionId; }
  async accountChanged(nextAccountId: string | null): Promise<string> {
    if (nextAccountId === this.accountId) return this.anonymousId;
    this.accountId = nextAccountId; this.anonymousId = this.deps.uuid();
    await this.deps.set(ANONYMOUS_KEY, this.anonymousId); await this.deps.set(ACCOUNT_KEY, nextAccountId ?? "");
    return this.anonymousId;
  }
}
