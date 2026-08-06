import { safeAnalyticsProperties } from "./product-analytics-utils";

export { safeAnalyticsProperties } from "./product-analytics-utils";

export type ProductAnalyticsEvent =
  | "onboarding_screen_viewed"
  | "onboarding_cta_pressed"
  | "onboarding_demo_tab_opened"
  | "paywall_viewed"
  | "purchase_started"
  | "purchase_succeeded"
  | "purchase_cancelled"
  | "purchase_failed"
  | "purchase_restored"
  | "analysis_reservation_denied"
  | "analysis_cancelled";

export async function trackProductEvent(eventName: ProductAnalyticsEvent, properties: Record<string, string | number | boolean | null> = {}): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  const { supabase } = await import("@/lib/supabase");
  await supabase.rpc("record_product_analytics", { p_event_name: eventName, p_properties: safeAnalyticsProperties(properties) }).then(({ error }) => {
    if (error) throw error;
  });
}
