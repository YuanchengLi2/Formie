import {
  executeSubscriptionIntent,
  normalizeSubscriptionStore,
  openSubscriptionIntent,
  recordSubscriptionIntent,
  transitionSubscriptionIntent,
  type SubscriptionIntentDependencies,
} from "./subscription-intent";

describe("subscription intent state", () => {
  it("requires confirmation and a reason before cancelling", () => {
    let state = openSubscriptionIntent("active_renewing");
    expect(state).toMatchObject({ action: "cancel", stage: "confirm_cancel" });

    state = transitionSubscriptionIntent(state, { type: "confirm" })!;
    expect(state).toMatchObject({ action: "cancel", stage: "choose_reason" });

    state = transitionSubscriptionIntent(state, { type: "select_reason", reason: "not_using_enough" })!;
    expect(state).toMatchObject({ stage: "choose_reason", reason: "not_using_enough" });
    state = transitionSubscriptionIntent(state, { type: "confirm" })!;
    expect(state).toMatchObject({ stage: "executing", reason: "not_using_enough" });
  });

  it("requires confirmation before resuming a paid-through cancellation", () => {
    const state = openSubscriptionIntent("active_cancelled");
    expect(state).toMatchObject({ action: "resume", stage: "confirm_resume" });
    expect(transitionSubscriptionIntent(state, { type: "cancel" })).toBeNull();
    expect(transitionSubscriptionIntent(state, { type: "confirm" })).toMatchObject({ action: "resume", stage: "executing" });
  });

  it("supports retrying a failed cancellation choice without losing the selected reason", () => {
    const failed = transitionSubscriptionIntent(
      { action: "cancel", stage: "executing", reason: "technical_issues" },
      { type: "fail", message: "Provider unavailable" },
    );
    expect(failed).toMatchObject({ stage: "error", reason: "technical_issues", error: "Provider unavailable" });
    expect(transitionSubscriptionIntent(failed!, { type: "retry" })).toMatchObject({ stage: "choose_reason", reason: "technical_issues" });
  });
});

describe("subscription intent execution", () => {
  function dependencies(overrides: Partial<SubscriptionIntentDependencies> = {}): SubscriptionIntentDependencies {
    return {
      recordIntent: jest.fn().mockResolvedValue(undefined),
      runTestControl: jest.fn().mockResolvedValue(undefined),
      openProviderUrl: jest.fn().mockResolvedValue(undefined),
      refreshAccess: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it("records the reason before applying Test Store cancellation and refreshing access", async () => {
    const deps = dependencies();
    await executeSubscriptionIntent({
      action: "cancel",
      reason: "too_expensive",
      store: "test_store",
      isTestStore: true,
      managementUrl: null,
    }, deps);
    expect(deps.recordIntent).toHaveBeenCalledWith({ action: "cancel", reason: "too_expensive", store: "test_store", surface: "mobile" });
    expect(deps.runTestControl).toHaveBeenCalledWith("cancel_at_period_end");
    expect(deps.refreshAccess).toHaveBeenCalledTimes(1);
    expect(deps.openProviderUrl).not.toHaveBeenCalled();
  });

  it("opens the production provider handoff after a resume intent", async () => {
    const deps = dependencies();
    await executeSubscriptionIntent({
      action: "resume",
      reason: null,
      store: "app_store",
      isTestStore: false,
      managementUrl: "https://apps.apple.com/account/subscriptions",
    }, deps);
    expect(deps.recordIntent).toHaveBeenCalledWith({ action: "resume", reason: null, store: "app_store", surface: "mobile" });
    expect(deps.openProviderUrl).toHaveBeenCalledWith("https://apps.apple.com/account/subscriptions");
    expect(deps.runTestControl).not.toHaveBeenCalled();
  });

  it("does not block a Test Store action when intent analytics is unavailable", async () => {
    const deps = dependencies({ recordIntent: jest.fn().mockRejectedValue(new Error("analytics down")) });
    await expect(executeSubscriptionIntent({
      action: "cancel",
      reason: "other",
      store: "test_store",
      isTestStore: true,
      managementUrl: null,
    }, deps)).resolves.toBe("test_store");
    expect(deps.runTestControl).toHaveBeenCalledWith("cancel_at_period_end");
  });

  it("normalizes unknown store values before persistence", () => {
    expect(normalizeSubscriptionStore("app_store")).toBe("app_store");
    expect(normalizeSubscriptionStore("play_store")).toBe("play_store");
    expect(normalizeSubscriptionStore("test_store")).toBe("test_store");
    expect(normalizeSubscriptionStore("stripe")).toBe("unknown");
    expect(normalizeSubscriptionStore(null)).toBe("unknown");
  });

  it("persists the structured mobile intent through the dedicated RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    await recordSubscriptionIntent({
      action: "cancel",
      reason: "prefer_not_to_say",
      store: "test_store",
      surface: "mobile",
    }, { rpc });
    expect(rpc).toHaveBeenCalledWith("record_subscription_management_intent", {
      p_action: "cancel",
      p_reason: "prefer_not_to_say",
      p_surface: "mobile",
      p_store: "test_store",
    });
  });
});
