import { analyticsQueue } from "./analytics-queue";
import { safeAnalyticsProperties } from "./product-analytics-utils";

export { safeAnalyticsProperties } from "./product-analytics-utils";

export type ProductAnalyticsEvent =
  | "app_session_started"
  | "onboarding_screen_viewed"
  | "onboarding_cta_pressed"
  | "onboarding_demo_tab_opened"
  | "onboarding_questionnaire_completed"
  | "account_created"
  | "paywall_viewed"
  | "purchase_started"
  | "purchase_succeeded"
  | "purchase_cancelled"
  | "purchase_failed"
  | "purchase_restored"
  | "subscription_management_intent"
  | "subscription_management_opened"
  | "analysis_reservation_denied"
  | "analysis_cancelled"
  | "exercise_selected"
  | "recording_started"
  | "recording_completed"
  | "recording_failed"
  | "upload_started"
  | "upload_completed"
  | "upload_failed"
  | "analysis_result_viewed"
  | "feedback_prompt_viewed"
  | "coaching_section_viewed"
  | "record_another_set_clicked"
  | "reanalysis_started";

export async function trackProductEvent(eventName: ProductAnalyticsEvent, properties: Record<string, string | number | boolean | null> = {}, links: { captureFlowId?: string | null; analysisSessionId?: string | null } = {}): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  await analyticsQueue.enqueue(eventName, safeAnalyticsProperties(properties), links);
}
