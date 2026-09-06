import * as Crypto from "expo-crypto";

import { supabase } from "@/lib/supabase";
import type { ProductAnalyticsEvent } from "./product-analytics";
import { analyticsStorage, type AnalyticsStorage } from "./analytics-storage";

type Scalar = string | number | boolean | null;
export type QueuedAnalyticsEvent = {
  clientEventId: string;
  eventName: ProductAnalyticsEvent;
  occurredAt: string;
  appSessionId: string;
  captureFlowId: string | null;
  analysisSessionId: string | null;
  userId: string | null;
  properties: Record<string, Scalar>;
};
type Identity = { anonymousId: string; installationSecret: string; accountId: string | null };

const MAX_EVENTS = 200;

async function newSecret(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function newUuid(): string {
  const native = typeof Crypto.randomUUID === "function" ? Crypto.randomUUID() : globalThis.crypto?.randomUUID?.();
  if (native) return native;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

async function newIdentity(accountId: string | null = null): Promise<Identity> {
  return { anonymousId: newUuid(), installationSecret: await newSecret(), accountId };
}

export class AnalyticsQueue {
  private identity: Identity | null = null;
  private events: QueuedAnalyticsEvent[] = [];
  private accountId: string | null = null;
  private appSessionId = newUuid();
  private loaded: Promise<void> | null = null;
  private flushing: Promise<void> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private failedFlushes = 0;
  private nextFlushAt = 0;

  private scheduleFlush(delay = 250): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush().catch(() => undefined);
    }, delay);
    const timer = this.flushTimer as ReturnType<typeof setTimeout> & { unref?: () => void };
    timer.unref?.();
  }

  constructor(
    private readonly storage: AnalyticsStorage = analyticsStorage,
    private readonly deliver: (body: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> = async (body) => supabase.functions.invoke("record-product-analytics", { body }),
  ) {}

  private async persist(): Promise<void> {
    if (!this.identity) return;
    await Promise.all([
      this.storage.writeIdentity(JSON.stringify(this.identity)),
      this.storage.writeQueue(JSON.stringify(this.events)),
    ]);
  }

  async load(): Promise<void> {
    if (this.loaded) return this.loaded;
    this.loaded = (async () => {
      const [identityRaw, queueRaw] = await Promise.all([this.storage.readIdentity(), this.storage.readQueue()]);
      try { this.identity = identityRaw ? JSON.parse(identityRaw) as Identity : null; } catch { this.identity = null; }
      try { this.events = queueRaw ? (JSON.parse(queueRaw) as QueuedAnalyticsEvent[]).slice(-MAX_EVENTS) : []; } catch { this.events = []; }
      this.identity ??= await newIdentity();
      this.accountId = this.identity.accountId;
      await this.persist();
    })();
    return this.loaded;
  }

  async setAccount(accountId: string | null): Promise<void> {
    await this.load();
    if (this.accountId === accountId) return;
    const previous = this.accountId;
    this.accountId = accountId;
    if (previous && previous !== accountId) {
      this.events = [];
      this.identity = await newIdentity(accountId);
    } else if (this.identity) {
      this.identity.accountId = accountId;
    }
    await this.persist();
  }

  async beginForegroundSession(): Promise<void> {
    await this.load();
    this.appSessionId = newUuid();
    await this.enqueue("app_session_started", {});
  }

  async enqueue(eventName: ProductAnalyticsEvent, properties: Record<string, Scalar>, links: { captureFlowId?: string | null; analysisSessionId?: string | null } = {}): Promise<void> {
    await this.load();
    this.events.push({ clientEventId: newUuid(), eventName, occurredAt: new Date().toISOString(), appSessionId: this.appSessionId, captureFlowId: links.captureFlowId ?? null, analysisSessionId: links.analysisSessionId ?? null, userId: this.accountId, properties });
    this.events = this.events.slice(-MAX_EVENTS);
    await this.persist();
    this.scheduleFlush();
  }

  async flush(): Promise<void> {
    await this.load();
    if (this.flushing) return this.flushing;
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    this.flushing = (async () => {
      if (!this.identity || this.events.length === 0) return;
      if (Date.now() < this.nextFlushAt) {
        this.scheduleFlush(this.nextFlushAt - Date.now());
        return;
      }
      while (true) {
        const eligible = this.events.filter((event) => event.userId === null || event.userId === this.accountId).slice(0, 25);
        if (eligible.length === 0) return;
        const { data, error } = await this.deliver({ anonymousId: this.identity.anonymousId, installationSecret: this.identity.installationSecret, events: eligible.map(({ userId: _userId, ...event }) => event) });
        if (error) {
          this.failedFlushes = Math.min(this.failedFlushes + 1, 8);
          const delay = Math.min(60_000, 1_000 * 2 ** (this.failedFlushes - 1));
          this.nextFlushAt = Date.now() + delay;
          this.scheduleFlush(delay);
          throw error;
        }
        this.failedFlushes = 0;
        this.nextFlushAt = 0;
        const values = data && typeof data === "object" && Array.isArray((data as { accepted?: unknown }).accepted) ? (data as { accepted: unknown[] }).accepted : [];
        const accepted = new Set(values.filter((item): item is string => typeof item === "string"));
        if (accepted.size === 0) return;
        this.events = this.events.filter((event) => !accepted.has(event.clientEventId));
        await this.persist();
      }
    })().finally(() => { this.flushing = null; });
    return this.flushing;
  }
}

export const analyticsQueue = new AnalyticsQueue();
