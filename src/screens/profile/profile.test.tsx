import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ProfileScreen } from ".";

describe("ProfileScreen", () => {
  it("keeps preferences and exposes subscription management without a public username", async () => {
    const screen = await render(<ProfileScreen displayName="Yuan" />);
    expect(screen.getByText("Yuan")).toBeTruthy();
    expect(screen.queryByText("@yuan_lifts")).toBeNull();
    expect(screen.getByText("Preferences")).toBeTruthy();
    expect(screen.getByText("Help & Support")).toBeTruthy();
    expect(screen.queryByText("Premium support")).toBeNull();
    expect(screen.queryByText("Send Feedback")).toBeNull();
    expect(screen.queryByText("Saved on this device")).toBeNull();
    expect(screen.queryByText("No cloud video library")).toBeNull();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage subscription" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete Account" })).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId("profile-responsive-screen").props.contentContainerStyle)).toMatchObject({
      width: "100%",
      maxWidth: 560,
    });
  });

  it("opens the authoritative native management flow without exposing client-side cancel mutations", async () => {
    const onManageSubscription = jest.fn();
    const screen = await render(<ProfileScreen subscription={{ plan: "Formie Monthly", stateLabel: "Canceled · Automatic renewal off" }} onManageSubscription={onManageSubscription} />);
    expect(screen.getByText("Canceled · Automatic renewal off")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Manage subscription" }));
    expect(onManageSubscription).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Cancel Subscription|Resume Subscription|Resubscribe/i)).toBeNull();
  });

  it("edits the name in a focused modal and saves preferences immediately", async () => {
    const onSaveProfile = jest.fn().mockResolvedValue(undefined);
    const onSaveCapturePreferences = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen displayName="Yuan" capturePreferences={{ countdownSeconds: 10, recordingVibrationEnabled: true, interactionHapticsEnabled: true }} onSaveProfile={onSaveProfile} onSaveCapturePreferences={onSaveCapturePreferences} />);
    await fireEvent.press(screen.getByRole("button", { name: "Edit account" }));
    await fireEvent.changeText(screen.getByLabelText("Display name"), "Yuan Cheng");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ displayName: "Yuan Cheng" }));
    await fireEvent.press(screen.getByText("15s"));
    await fireEvent(screen.getByLabelText("Vibrate on record"), "valueChange", false);
    await waitFor(() => expect(onSaveCapturePreferences).toHaveBeenLastCalledWith({ countdownSeconds: 15, recordingVibrationEnabled: false, interactionHapticsEnabled: true }));
    expect(screen.queryByText("Save Changes")).toBeNull();
  });

  it("keeps apply retryable and logout available", async () => {
    const onSaveProfile = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const onLogOut = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen onSaveProfile={onSaveProfile} onLogOut={onLogOut} />);
    await fireEvent.press(screen.getByRole("button", { name: "Edit account" }));
    await fireEvent.changeText(screen.getByLabelText("Display name"), "Formie Athlete Updated");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Your display name could not be saved. Try again.")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByRole("button", { name: "Log Out" }));
    expect(onLogOut).toHaveBeenCalledTimes(1);
  });

  it("opens Get Help and all configured policy links", async () => {
    const onOpenUrl = jest.fn().mockResolvedValue(undefined);
    const onSendFeedback = jest.fn();
    const screen = await render(<ProfileScreen termsUrl="https://example.com/terms" privacyUrl="https://example.com/privacy" privacyChoicesUrl="https://example.com/privacy-choices" retentionUrl="https://example.com/retention" onOpenUrl={onOpenUrl} onSendFeedback={onSendFeedback} />);
    await fireEvent.press(screen.getByText("Help & Support"));
    await fireEvent.press(screen.getByText("Terms of Use"));
    await fireEvent.press(screen.getByText("Privacy Policy"));
    await fireEvent.press(screen.getByText("Privacy Choices"));
    await fireEvent.press(screen.getByText("Retention Policy"));
    expect(onSendFeedback).toHaveBeenCalledTimes(1);
    expect(onOpenUrl).toHaveBeenNthCalledWith(1, "https://example.com/terms");
    expect(onOpenUrl).toHaveBeenNthCalledWith(2, "https://example.com/privacy");
    expect(onOpenUrl).toHaveBeenNthCalledWith(3, "https://example.com/privacy-choices");
    expect(onOpenUrl).toHaveBeenNthCalledWith(4, "https://example.com/retention");
  });

  it("shows the current AI processing consent and withdraws future processing without changing prior results", async () => {
    const onWithdrawAiConsent = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen aiConsent={{ current: true, version: "2026-09-01" }} onWithdrawAiConsent={onWithdrawAiConsent} />);

    expect(screen.getByText("AI Processing")).toBeTruthy();
    expect(screen.getByText("Agreed · Notice 2026-09-01")).toBeTruthy();
    expect(screen.getByText(/blocks new analyses and retries/i)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Withdraw AI processing consent" }));
    await waitFor(() => expect(onWithdrawAiConsent).toHaveBeenCalledTimes(1));
  });

  it("keeps the subscription chevron aligned with the plan title", async () => {
    const screen = await render(<ProfileScreen subscription={{ plan: "Formie Monthly", stateLabel: "Active" }} />);
    expect(screen.getByTestId("subscription-chevron").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ alignSelf: "center" })]));
  });

  it("shows grouped identity, subscription, and development Test Store lifecycle controls", async () => {
    const onTestControl = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen displayName="Yuan" email="yuan@example.com" subscription={{ plan: "Formie Annual", stateLabel: "Active · Automatic renewal on · Next billing Sep 1, 2026 at 8:56 AM UTC" }} showTestControls onTestControl={onTestControl} />);
    expect(screen.getByText("yuan@example.com")).toBeTruthy();
    expect(screen.getByText("Formie Annual")).toBeTruthy();
    expect(screen.queryByText(/analyses left/i)).toBeNull();
    expect(screen.getByText("Active · Automatic renewal on · Next billing Sep 1, 2026 at 8:56 AM UTC")).toBeTruthy();
    expect(screen.queryByText(/Test period ends/i)).toBeNull();
    expect(screen.queryByText("Analysis balance")).toBeNull();
    expect(screen.queryByLabelText("Apply remaining analyses")).toBeNull();
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

  it("warns about Apple billing and requires exact typed confirmation", async () => {
    const onDeleteAccount = jest.fn().mockResolvedValue(undefined);
    const onManageSubscription = jest.fn();
    const screen = await render(<ProfileScreen hasManagedSubscription onDeleteAccount={onDeleteAccount} onManageSubscription={onManageSubscription} />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
    expect(screen.getByText(/does not cancel your Apple subscription/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete Account Now" }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Manage Apple Subscription" }));
    expect(onManageSubscription).toHaveBeenCalledTimes(1);
    await fireEvent.changeText(screen.getByLabelText("Type DELETE to confirm"), "delete");
    expect(screen.getByRole("button", { name: "Delete Account Now" }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    await fireEvent.press(screen.getByRole("button", { name: "Delete Account Now" }));
    await waitFor(() => expect(onDeleteAccount).toHaveBeenCalledTimes(1));
  });

  it("cancels deletion without calling the destructive action", async () => {
    const onDeleteAccount = jest.fn();
    const screen = await render(<ProfileScreen onDeleteAccount={onDeleteAccount} />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
    expect(screen.getByText(/deletes your Formie account immediately/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Manage Apple Subscription" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Cancel account deletion" }));
    expect(screen.queryByLabelText("Type DELETE to confirm")).toBeNull();
    expect(onDeleteAccount).not.toHaveBeenCalled();
  });

  it("prevents duplicate deletion requests while one is pending", async () => {
    let resolveDeletion!: () => void;
    const onDeleteAccount = jest.fn(() => new Promise<void>((resolve) => { resolveDeletion = resolve; }));
    const screen = await render(<ProfileScreen onDeleteAccount={onDeleteAccount} />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
    await fireEvent.changeText(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    const submit = screen.getByRole("button", { name: "Delete Account Now" });
    await fireEvent.press(submit);
    await fireEvent.press(submit);
    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
    resolveDeletion();
    await waitFor(() => expect(onDeleteAccount).toHaveBeenCalledTimes(1));
  });

  it("keeps the dialog open with a retryable truthful failure", async () => {
    const onDeleteAccount = jest.fn().mockRejectedValueOnce(new Error("failed")).mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen onDeleteAccount={onDeleteAccount} />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
    await fireEvent.changeText(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    await fireEvent.press(screen.getByRole("button", { name: "Delete Account Now" }));
    expect(await screen.findByText("Your account could not be deleted. No deletion was confirmed. Try again.")).toBeTruthy();
    expect(screen.getByLabelText("Type DELETE to confirm")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Delete Account Now" }));
    await waitFor(() => expect(onDeleteAccount).toHaveBeenCalledTimes(2));
  });

  it("never requires another Apple sign-in before retrying account deletion", async () => {
    const onDeleteAccount = jest.fn().mockRejectedValue(Object.assign(new Error("reauth"), { code: "APPLE_REAUTH_REQUIRED" }));
    const screen = await render(<ProfileScreen onDeleteAccount={onDeleteAccount} />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
    await fireEvent.changeText(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    await fireEvent.press(screen.getByRole("button", { name: "Delete Account Now" }));
    expect(await screen.findByText("Your account could not be deleted. No deletion was confirmed. Try again.")).toBeTruthy();
    expect(screen.queryByTestId("provider-apple")).toBeNull();
  });
});
