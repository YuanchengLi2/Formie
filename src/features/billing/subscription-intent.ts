import { supabase } from "@/lib/supabase";

export type SubscriptionIntentAction = "cancel" | "resume";
export type CancellationReason =
  | "too_expensive"
  | "not_using_enough"
  | "coaching_not_helpful"
  | "technical_issues"
  | "other"
  | "prefer_not_to_say";
export type SubscriptionIntentStage = "confirm_cancel" | "choose_reason" | "confirm_resume" | "executing" | "error";
export type SubscriptionIntentStore = "app_store" | "play_store" | "test_store" | "unknown";
export type SubscriptionIntentSurface = "mobile" | "website";

export const cancellationReasons: readonly { value: CancellationReason; label: string }[] = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "not_using_enough", label: "Not using it enough" },
  { value: "coaching_not_helpful", label: "Coaching was not helpful" },
  { value: "technical_issues", label: "Technical issues" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export type SubscriptionIntentState = {
  action: SubscriptionIntentAction;
  stage: SubscriptionIntentStage;
  reason?: CancellationReason;
  error?: string;
};

export type SubscriptionIntentEvent =
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "select_reason"; reason: CancellationReason }
  | { type: "fail"; message: string }
  | { type: "retry" };

export function openSubscriptionIntent(lifecycleState: string | null | undefined): SubscriptionIntentState {
  return lifecycleState === "active_cancelled"
    ? { action: "resume", stage: "confirm_resume" }
    : { action: "cancel", stage: "confirm_cancel" };
}

export function transitionSubscriptionIntent(
  state: SubscriptionIntentState,
  event: SubscriptionIntentEvent,
): SubscriptionIntentState | null {
  if (event.type === "cancel") return null;

  if (event.type === "fail") {
    return { ...state, stage: "error", error: event.message };
  }

  if (event.type === "retry" && state.stage === "error") {
    return state.action === "cancel"
      ? { action: "cancel", stage: "choose_reason", reason: state.reason }
      : { action: "resume", stage: "confirm_resume" };
  }

  if (event.type === "select_reason" && state.action === "cancel" && state.stage === "choose_reason") {
    return { ...state, reason: event.reason, error: undefined };
  }

  if (event.type === "confirm") {
    if (state.action === "cancel" && state.stage === "confirm_cancel") {
      return { action: "cancel", stage: "choose_reason" };
    }
    if (state.action === "cancel" && state.stage === "choose_reason" && state.reason) {
      return { ...state, stage: "executing", error: undefined };
    }
    if (state.action === "resume" && state.stage === "confirm_resume") {
      return { action: "resume", stage: "executing" };
    }
  }

  return state;
}

export function normalizeSubscriptionStore(value: string | null | undefined): SubscriptionIntentStore {
  if (value === "app_store" || value === "play_store" || value === "test_store") return value;
  return "unknown";
}

export type SubscriptionIntentRecord = {
  action: SubscriptionIntentAction;
  reason: CancellationReason | null;
  store: SubscriptionIntentStore;
  surface: SubscriptionIntentSurface;
};

type RpcClient = {
  rpc: (functionName: string, args: Record<string, unknown>) => unknown;
};

export async function recordSubscriptionIntent(
  input: SubscriptionIntentRecord,
  client: RpcClient = supabase,
): Promise<void> {
  const result = await client.rpc("record_subscription_management_intent", {
    p_action: input.action,
    p_reason: input.reason,
    p_surface: input.surface,
    p_store: input.store,
  }) as { error: { message?: string } | null };
  const { error } = result;
  if (error) throw new Error(error.message || "Subscription intent could not be recorded.");
}

export type SubscriptionIntentExecutionInput = {
  action: SubscriptionIntentAction;
  reason?: CancellationReason | null;
  store: string | null | undefined;
  isTestStore: boolean;
  managementUrl: string | null | undefined;
};

export type SubscriptionIntentDependencies = {
  recordIntent: (input: SubscriptionIntentRecord) => Promise<void>;
  runTestControl?: (action: "cancel_at_period_end" | "uncancel") => Promise<unknown>;
  openProviderUrl?: (url: string) => Promise<unknown>;
  refreshAccess: () => Promise<unknown>;
};

export async function executeSubscriptionIntent(
  input: SubscriptionIntentExecutionInput,
  dependencies: SubscriptionIntentDependencies,
): Promise<"test_store" | "provider"> {
  const reason = input.action === "cancel" ? input.reason ?? null : null;
  if (input.action === "cancel" && !reason) throw new Error("Choose a reason before cancelling.");

  const record = {
    action: input.action,
    reason,
    store: normalizeSubscriptionStore(input.store),
    surface: "mobile" as const,
  };
  await dependencies.recordIntent(record).catch(() => undefined);

  if (input.isTestStore) {
    if (!dependencies.runTestControl) throw new Error("The Test Store control is unavailable.");
    await dependencies.runTestControl(input.action === "cancel" ? "cancel_at_period_end" : "uncancel");
    await dependencies.refreshAccess();
    return "test_store";
  }

  if (!input.managementUrl || !dependencies.openProviderUrl) {
    throw new Error("Subscription management is unavailable right now.");
  }
  await dependencies.openProviderUrl(input.managementUrl);
  return "provider";
}
