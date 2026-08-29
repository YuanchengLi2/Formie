import { safeAnalyticsProperties, type AnalyticsProperty } from "./product-analytics-utils";

export { analyticsExerciseId, safeAnalyticsProperties } from "./product-analytics-utils";

export type ProductAnalyticsEvent =
  | "app_session_started"
  | "onboarding_screen_viewed"
  | "onboarding_cta_pressed"
  | "onboarding_demo_tab_opened"
  | "paywall_viewed"
  | "purchase_started"
  | "purchase_succeeded"
  | "purchase_cancelled"
  | "purchase_failed"
  | "purchase_restored"
  | "subscription_management_opened"
  | "analysis_reservation_denied"
  | "analysis_cancelled"
  | "exercise_selected"
  | "recording_started"
  | "recording_completed"
  | "recording_failed"
  | "upload_started"
  | "analysis_result_viewed"
  | "feedback_prompt_viewed"
  | "coaching_section_viewed"
  | "record_another_set_clicked"
  | "reanalysis_started";

export type AnalyticsEventInput = { clientEventId: string; eventName: ProductAnalyticsEvent; occurredAt: string; anonymousId: string; appSessionId: string; captureFlowId?: string; analysisSessionId?: string; properties?: Record<string, AnalyticsProperty> };
type AnalyticsEnqueuer = (eventName: ProductAnalyticsEvent, properties: Record<string, unknown>, context?: Partial<Pick<AnalyticsEventInput, "captureFlowId" | "analysisSessionId">>) => void;
let enqueue: AnalyticsEnqueuer | null = null;
let currentAppSessionId: string | null = null;

export function registerProductAnalyticsEnqueuer(next: AnalyticsEnqueuer | null): void { enqueue = next; }
export function registerAnalyticsAppSession(appSessionId: string | null): void { currentAppSessionId = appSessionId; }
export function getAnalyticsContext(captureFlowId: string | null | undefined): { captureFlowId: string; appSessionId: string } | undefined { return captureFlowId && currentAppSessionId ? { captureFlowId, appSessionId: currentAppSessionId } : undefined; }

export function trackProductEvent(eventName: ProductAnalyticsEvent, properties: Record<string, unknown> = {}, context?: Partial<Pick<AnalyticsEventInput, "captureFlowId" | "analysisSessionId">>): void {
  try { enqueue?.(eventName, safeAnalyticsProperties(eventName, properties), context); } catch { /* analytics never blocks product behavior */ }
}
