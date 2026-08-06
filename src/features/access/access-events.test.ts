import { publishAccessMutation, subscribeAccessMutations } from "./access-events";

describe("access mutation events", () => {
  it("delivers the authoritative remaining balance and supports unsubscribe", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAccessMutations(listener);
    publishAccessMutation({ remaining: 9, periodEndsAt: "2026-09-01T00:00:00Z" });
    expect(listener).toHaveBeenCalledWith({ remaining: 9, periodEndsAt: "2026-09-01T00:00:00Z" });
    unsubscribe();
    publishAccessMutation({ remaining: 8, periodEndsAt: "2026-09-01T00:00:00Z" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
