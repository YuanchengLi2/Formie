const eventNames = new Set(["app_session_started", "onboarding_screen_viewed", "onboarding_cta_pressed", "onboarding_demo_tab_opened", "paywall_viewed", "purchase_started", "purchase_succeeded", "purchase_cancelled", "purchase_failed", "purchase_restored", "subscription_management_opened", "analysis_reservation_denied", "analysis_cancelled", "exercise_selected", "recording_started", "recording_completed", "recording_failed", "upload_started", "analysis_result_viewed", "feedback_prompt_viewed", "coaching_section_viewed", "record_another_set_clicked", "reanalysis_started"]);
const eventPropertyKeys: Record<string, Set<string>> = {
  app_session_started: new Set(["platform", "appVersion", "buildNumber"]), onboarding_screen_viewed: new Set(["screenId", "step", "onboardingVersion"]), onboarding_cta_pressed: new Set(["screenId", "step", "onboardingVersion"]), onboarding_demo_tab_opened: new Set(["tab", "onboardingVersion"]),
  paywall_viewed: new Set(["offerId", "source"]), purchase_started: new Set(["offerId", "productId"]), purchase_succeeded: new Set(["offerId", "productId"]), purchase_cancelled: new Set(["offerId", "productId", "errorCategory"]), purchase_failed: new Set(["offerId", "productId", "errorCategory"]), purchase_restored: new Set(["productId"]), subscription_management_opened: new Set(["source"]),
  analysis_reservation_denied: new Set(["errorCategory", "source"]), analysis_cancelled: new Set(["errorCategory", "source"]), exercise_selected: new Set(["exerciseId", "source", "hasPreviousAnalysis"]), recording_started: new Set(["exerciseId", "source"]), recording_completed: new Set(["exerciseId", "source", "durationBucket"]), recording_failed: new Set(["exerciseId", "source", "errorCategory"]), upload_started: new Set(["exerciseId", "source"]), analysis_result_viewed: new Set(["analysisType"]), feedback_prompt_viewed: new Set(["analysisType"]), coaching_section_viewed: new Set(["sectionId", "analysisType"]), record_another_set_clicked: new Set(["analysisType"]), reanalysis_started: new Set(["analysisType", "source"]),
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeText = /^[a-zA-Z0-9_.:-]{1,80}$/;
export type ValidAnalyticsEvent = { clientEventId: string; eventName: string; occurredAt: string; anonymousId: string; appSessionId: string; captureFlowId?: string; analysisSessionId?: string; properties?: Record<string, string | number | boolean | null> };
export type RecordProductAnalyticsDependencies = { resolveUserId: (request: Request) => Promise<string | null>; ingest: (input: { userId: string | null; ipHash: string; events: ValidAnalyticsEvent[] }) => Promise<string[]> };
function json(payload: unknown, status: number): Response { return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function parseEvent(value: unknown): ValidAnalyticsEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const allowed = new Set(["clientEventId", "eventName", "occurredAt", "anonymousId", "appSessionId", "captureFlowId", "analysisSessionId", "properties"]);
  if (Object.keys(candidate).some((key) => !allowed.has(key))) return null;
  if (![candidate.clientEventId, candidate.anonymousId, candidate.appSessionId].every((item) => typeof item === "string" && uuid.test(item))) return null;
  if (candidate.captureFlowId !== undefined && (typeof candidate.captureFlowId !== "string" || !uuid.test(candidate.captureFlowId))) return null;
  if (candidate.analysisSessionId !== undefined && (typeof candidate.analysisSessionId !== "string" || !uuid.test(candidate.analysisSessionId))) return null;
  if (typeof candidate.eventName !== "string" || !eventNames.has(candidate.eventName) || typeof candidate.occurredAt !== "string" || !Number.isFinite(Date.parse(candidate.occurredAt))) return null;
  if (candidate.properties !== undefined) {
    if (!candidate.properties || typeof candidate.properties !== "object" || Array.isArray(candidate.properties)) return null;
    const properties = candidate.properties as Record<string, unknown>;
    if (Object.keys(properties).some((key) => !eventPropertyKeys[candidate.eventName as string].has(key))) return null;
    for (const item of Object.values(properties)) {
      if (item === null || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) continue;
      if (typeof item !== "string" || !safeText.test(item) || item.includes("@") || item.includes("/") || item.includes("\\")) return null;
    }
  }
  return candidate as ValidAnalyticsEvent;
}
export async function recordProductAnalyticsHandler(request: Request, dependencies: RecordProductAnalyticsDependencies, ipHash: string): Promise<Response> {
  if (request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  let body: unknown; try { body = await request.json(); } catch { return json({ code: "INVALID_BODY" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "events")) return json({ code: "INVALID_BODY" }, 400);
  const raw = (body as { events?: unknown }).events;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 25) return json({ code: "INVALID_BODY" }, 400);
  const events = raw.map(parseEvent); if (events.some((item) => !item)) return json({ code: "INVALID_BODY" }, 400);
  try {
    const userId = await dependencies.resolveUserId(request);
    return json({ acceptedEventIds: await dependencies.ingest({ userId, ipHash, events: events as ValidAnalyticsEvent[] }) }, 200);
  } catch (error) {
    const rateLimited = error instanceof Error && error.message.includes("RATE_LIMIT");
    return json({ code: rateLimited ? "RATE_LIMITED" : "INGESTION_UNAVAILABLE" }, rateLimited ? 429 : 503);
  }
}
