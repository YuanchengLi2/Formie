export function safeAnalyticsProperties(properties: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const allowed = new Set(["screenId", "step", "onboardingVersion", "tab", "offerId", "errorCategory", "platform"]);
  return Object.fromEntries(Object.entries(properties).filter(([key, value]) => allowed.has(key) && (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"))) as Record<string, string | number | boolean | null>;
}
