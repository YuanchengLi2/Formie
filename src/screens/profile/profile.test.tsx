import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ProfileScreen } from ".";

describe("ProfileScreen", () => {
  it("keeps preferences and exposes subscription management without a public username", async () => {
    const screen = await render(<ProfileScreen displayName="Yuan" />);
    expect(screen.getByText("Yuan")).toBeTruthy();
    expect(screen.queryByText("@yuan_lifts")).toBeNull();
    expect(screen.getByText("Capture")).toBeTruthy();
    expect(screen.getByText("Privacy and retention")).toBeTruthy();
    expect(screen.getByText("Send Feedback")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage subscription" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /delete account/i })).toBeNull();
  });

  it("opens the authoritative native management flow without exposing client-side cancel mutations", async () => {
    const onManageSubscription = jest.fn();
    const screen = await render(<ProfileScreen subscription={{ plan: "Formie Monthly", stateLabel: "Canceled · Automatic renewal off" }} onManageSubscription={onManageSubscription} />);
    expect(screen.getByText("Canceled · Automatic renewal off")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Manage subscription" }));
    expect(onManageSubscription).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Cancel Subscription|Resume Subscription|Resubscribe/i)).toBeNull();
  });

  it("stages athlete and capture edits until Apply Settings", async () => {
    const onSaveProfile = jest.fn().mockResolvedValue(undefined);
    const onSaveCapturePreferences = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen displayName="Yuan" capturePreferences={{ countdownSeconds: 10, hapticsEnabled: true }} onSaveProfile={onSaveProfile} onSaveCapturePreferences={onSaveCapturePreferences} />);
    await fireEvent.changeText(screen.getByLabelText("Display name"), "Yuan Cheng");
    await fireEvent.press(screen.getByText("15 sec"));
    await fireEvent(screen.getByLabelText("Start haptics"), "valueChange", false);
    expect(onSaveProfile).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ displayName: "Yuan Cheng" }));
    expect(onSaveCapturePreferences).toHaveBeenCalledWith({ countdownSeconds: 15, hapticsEnabled: false });
  });

  it("keeps apply retryable and logout available", async () => {
    const onSaveProfile = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const onLogOut = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen onSaveProfile={onSaveProfile} onLogOut={onLogOut} />);
    await fireEvent.changeText(screen.getByLabelText("Display name"), "Formie Athlete Updated");
    await fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => expect(screen.getByText("Settings could not be applied. Try again.")).toBeTruthy());
    await fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByRole("button", { name: "Log Out" }));
    expect(onLogOut).toHaveBeenCalledTimes(1);
  });

  it("shows legal links only when configured", async () => {
    const onOpenUrl = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen termsUrl="https://example.com/terms" privacyUrl="https://example.com/privacy" onOpenUrl={onOpenUrl} />);
    await fireEvent.press(screen.getByText("Terms of Use"));
    await fireEvent.press(screen.getByText("Privacy Policy"));
    expect(onOpenUrl).toHaveBeenNthCalledWith(1, "https://example.com/terms");
    expect(onOpenUrl).toHaveBeenNthCalledWith(2, "https://example.com/privacy");
  });

  it("shows grouped identity, subscription, and development Test Store lifecycle controls", async () => {
    const onTestControl = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen displayName="Yuan" email="yuan@example.com" subscription={{ plan: "Formie Annual", stateLabel: "Active · Automatic renewal on · Next billing Sep 1, 2026 at 8:56 AM UTC" }} showTestControls onTestControl={onTestControl} />);
    expect(screen.getByText("yuan@example.com")).toBeTruthy();
    expect(screen.getByText("Formie Annual")).toBeTruthy();
    expect(screen.queryByText(/analyses left/i)).toBeNull();
    expect(screen.getByText("Active · Automatic renewal on · Next billing Sep 1, 2026 at 8:56 AM UTC")).toBeTruthy();
    expect(screen.queryByText(/Test period ends/i)).toBeNull();
    expect(screen.getByText("Test Store lifecycle")).toBeTruthy();
    expect(screen.queryByText("Undo Cancellation")).toBeNull();
    await fireEvent.press(screen.getByText("Start 20-minute Period"));
    expect(onTestControl).toHaveBeenCalledWith("start_new_period");
  });

  it("shows the canceled access-end timestamp in Settings", async () => {
    const screen = await render(<ProfileScreen subscription={{ plan: "Formie Monthly", stateLabel: "Canceled · Automatic renewal off · Access ends Sep 1, 2026 at 8:56 AM UTC" }} />);
    expect(screen.getByText("Canceled · Automatic renewal off · Access ends Sep 1, 2026 at 8:56 AM UTC")).toBeTruthy();
    expect(screen.queryByText(/Next billing/i)).toBeNull();
  });

  it("applies a chosen remaining balance and exposes the simulated period action", async () => {
    const onSetTestRemaining = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen subscription={{ plan: "Formie Monthly", stateLabel: "Active" }} testRemaining={6} showTestControls onSetTestRemaining={onSetTestRemaining} />);
    await fireEvent.press(screen.getByLabelText("Decrease analyses remaining"));
    expect(screen.getByText("Analyses remaining: 5")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Apply remaining analyses"));
    await waitFor(() => expect(onSetTestRemaining).toHaveBeenCalledWith(5));
    expect(screen.getByText("Start 20-minute Period")).toBeTruthy();
  });
});
