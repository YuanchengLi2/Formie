import { claimRevenueCatWebhookEvent } from "./revenuecat-event-store";

function event() {
  return {
    id: "event-1",
    type: "RENEWAL",
    app_user_id: "user-1",
    aliases: [],
    environment: "PRODUCTION" as const,
    transaction_id: "transaction-1",
    store: "APP_STORE",
    raw_event: { id: "event-1" },
    recognized: true,
  };
}

describe("claimRevenueCatWebhookEvent", () => {
  it("leaves completed event projection metadata unchanged on duplicate delivery", async () => {
    const update = jest.fn();
    const admin = {
      rpc: jest.fn(async () => ({ data: "completed", error: null })),
      from: jest.fn(() => ({ update })),
    };

    await expect(claimRevenueCatWebhookEvent(admin as never, event())).resolves.toBe("completed");
    expect(update).not.toHaveBeenCalled();
  });
});
