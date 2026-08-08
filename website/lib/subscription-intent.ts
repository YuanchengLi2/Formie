import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionIntentAction = "cancel" | "resume";
export type CancellationReason =
  | "too_expensive"
  | "not_using_enough"
  | "coaching_not_helpful"
  | "technical_issues"
  | "other"
  | "prefer_not_to_say";
export type SubscriptionIntentStore = "app_store" | "play_store" | "test_store" | "unknown";

export const cancellationReasons: readonly { value: CancellationReason; label: string }[] = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "not_using_enough", label: "Not using it enough" },
  { value: "coaching_not_helpful", label: "Coaching was not helpful" },
  { value: "technical_issues", label: "Technical issues" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export function normalizeSubscriptionStore(value: string | null | undefined): SubscriptionIntentStore {
  if (value === "app_store" || value === "play_store" || value === "test_store") return value;
  return "unknown";
}

export async function recordWebsiteSubscriptionIntent(
  client: Pick<SupabaseClient, "rpc">,
  input: { action: SubscriptionIntentAction; reason: CancellationReason | null; store: string | null | undefined },
): Promise<void> {
  const { error } = await client.rpc("record_subscription_management_intent", {
    p_action: input.action,
    p_reason: input.action === "cancel" ? input.reason : null,
    p_surface: "website",
    p_store: normalizeSubscriptionStore(input.store),
  });
  if (error) throw new Error(error.message || "Subscription intent could not be recorded.");
}
