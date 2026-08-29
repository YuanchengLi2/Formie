import type { ProductAnalyticsEvent } from "./product-analytics";

export type AnalyticsProperty = string | number | boolean | null;

const propertyKeys: Record<ProductAnalyticsEvent, readonly string[]> = {
  app_session_started: ["platform", "appVersion", "buildNumber"], onboarding_screen_viewed: ["screenId", "step", "onboardingVersion"], onboarding_cta_pressed: ["screenId", "step", "onboardingVersion"], onboarding_demo_tab_opened: ["tab", "onboardingVersion"],
  paywall_viewed: ["offerId", "source"], purchase_started: ["offerId", "productId"], purchase_succeeded: ["offerId", "productId"], purchase_cancelled: ["offerId", "productId", "errorCategory"], purchase_failed: ["offerId", "productId", "errorCategory"], purchase_restored: ["productId"], subscription_management_opened: ["source"],
  analysis_reservation_denied: ["errorCategory", "source"], analysis_cancelled: ["errorCategory", "source"], exercise_selected: ["exerciseId", "source", "hasPreviousAnalysis"], recording_started: ["exerciseId", "source"], recording_completed: ["exerciseId", "source", "durationBucket"], recording_failed: ["exerciseId", "source", "errorCategory"], upload_started: ["exerciseId", "source"], analysis_result_viewed: ["analysisType"], feedback_prompt_viewed: ["analysisType"], coaching_section_viewed: ["sectionId", "analysisType"], record_another_set_clicked: ["analysisType"], reanalysis_started: ["analysisType", "source"],
};
const safeToken = /^[a-zA-Z0-9_.:-]{1,80}$/;

export function safeAnalyticsProperties(eventName: ProductAnalyticsEvent, properties: Record<string, unknown>): Record<string, AnalyticsProperty> {
  const allowed = new Set(propertyKeys[eventName]);
  const safe: Record<string, AnalyticsProperty> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key) || value === undefined) continue;
    if (value === null || typeof value === "boolean") safe[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "string" && safeToken.test(value) && !value.includes("@") && !value.includes("/") && !value.includes("\\")) safe[key] = value;
  }
  return safe;
}

export function analyticsExerciseId(catalogExerciseId: number | null | undefined): number | "custom" {
  return Number.isInteger(catalogExerciseId) && Number(catalogExerciseId) > 0 ? Number(catalogExerciseId) : "custom";
}
