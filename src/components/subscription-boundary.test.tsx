import { act, render } from "@testing-library/react-native";

import { SubscriptionBoundary } from "./subscription-boundary";

describe("SubscriptionBoundary", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("updates the countdown locally every second and reconciles once at zero", async () => {
    let now = new Date("2026-08-11T02:34:48Z");
    const onBoundary = jest.fn();
    const screen = await render(<SubscriptionBoundary access={{ lifecycleState: "active_renewing", willRenew: true, paidThrough: "2026-08-11T02:34:50Z", sandbox: true }} now={() => now} onBoundary={onBoundary} timeZone="UTC" />);
    expect(screen.getByText("Renews in 2s")).toBeTruthy();
    now = new Date("2026-08-11T02:34:49Z");
    await act(async () => jest.advanceTimersByTime(1_000));
    expect(screen.getByText("Renews in 1s")).toBeTruthy();
    now = new Date("2026-08-11T02:34:50Z");
    await act(async () => jest.advanceTimersByTime(1_000));
    expect(onBoundary).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(2_000));
    expect(onBoundary).toHaveBeenCalledTimes(1);
  });
});
