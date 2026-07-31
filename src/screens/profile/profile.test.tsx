import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ProfileScreen } from ".";

describe("ProfileScreen", () => {
  it("removes payment, experience, goal, gray cards, and an empty Legal section", async () => {
    const screen = await render(<ProfileScreen />);

    expect(screen.queryByText("Experience")).toBeNull();
    expect(screen.queryByText("Primary goal")).toBeNull();
    expect(screen.queryByText("FREE")).toBeNull();
    expect(screen.queryByText("PAID")).toBeNull();
    expect(screen.queryByText("Legal")).toBeNull();
    expect(screen.queryByTestId("settings-gray-card")).toBeNull();
  });

  it("stages edits until Apply Settings persists all settings", async () => {
    const onSaveProfile = jest.fn().mockResolvedValue(undefined);
    const onSaveCapturePreferences = jest.fn().mockResolvedValue(undefined);
    const onSetRetention = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <ProfileScreen
        displayName="Yuan"
        capturePreferences={{ countdownSeconds: 10, hapticsEnabled: true }}
        onSaveProfile={onSaveProfile}
        onSaveCapturePreferences={onSaveCapturePreferences}
        onSetRetention={onSetRetention}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText("Username"), "Yuan Cheng");
    await fireEvent.press(screen.getByText("15 sec"));
    await fireEvent(screen.getByLabelText("Start haptics"), "valueChange", false);
    expect(onSaveProfile).not.toHaveBeenCalled();
    expect(onSaveCapturePreferences).not.toHaveBeenCalled();
    expect(onSetRetention).not.toHaveBeenCalled();
    expect(screen.getByText("Saved on this device")).toBeTruthy();
    expect(screen.getByText("Analysis uploads are removed after processing")).toBeTruthy();
    expect(screen.queryByText("Keep until deleted")).toBeNull();
    expect(screen.queryByText("30 days")).toBeNull();

    await fireEvent.press(screen.getByText("Apply Settings"));
    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ displayName: "Yuan Cheng" }));
    expect(onSaveCapturePreferences).toHaveBeenCalledWith({ countdownSeconds: 15, hapticsEnabled: false });
    expect(onSetRetention).not.toHaveBeenCalled();
  });

  it("Reset Settings stages the documented defaults", async () => {
    const onSaveProfile = jest.fn().mockResolvedValue(undefined);
    const onSaveCapturePreferences = jest.fn().mockResolvedValue(undefined);
    const onSetRetention = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <ProfileScreen
        displayName="Custom"
        capturePreferences={{ countdownSeconds: 5, hapticsEnabled: false }}
        videoRetentionDays={30}
        onSaveProfile={onSaveProfile}
        onSaveCapturePreferences={onSaveCapturePreferences}
        onSetRetention={onSetRetention}
      />,
    );

    await fireEvent.press(screen.getByText("Reset Settings"));
    expect(screen.getByDisplayValue("Formie Athlete")).toBeTruthy();
    await fireEvent.press(screen.getByText("Apply Settings"));
    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ displayName: "Formie Athlete" }));
    expect(onSaveCapturePreferences).toHaveBeenCalledWith({ countdownSeconds: 10, hapticsEnabled: true });
    expect(onSetRetention).not.toHaveBeenCalled();
  });

  it("keeps Apply retryable after a persistence failure and uses a solid red Logout", async () => {
    const onSaveProfile = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen onSaveProfile={onSaveProfile} />);

    await fireEvent.press(screen.getByText("Apply Settings"));
    await waitFor(() => expect(screen.getByText("Settings could not be applied. Try again.")).toBeTruthy());
    await fireEvent.press(screen.getByText("Apply Settings"));
    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("logout-button")).toHaveStyle({ backgroundColor: "#F05A5A" });
  });

  it("shows direct account actions and Legal only when links exist", async () => {
    const onChangeEmail = jest.fn();
    const onChangePassword = jest.fn();
    const onOpenUrl = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <ProfileScreen
        email="user@example.com"
        onChangeEmail={onChangeEmail}
        onChangePassword={onChangePassword}
        termsUrl="https://example.com/terms"
        privacyUrl="https://example.com/privacy"
        onOpenUrl={onOpenUrl}
      />,
    );

    expect(screen.getByText("Legal")).toBeTruthy();
    await fireEvent.press(screen.getByText("Change Email"));
    await fireEvent.press(screen.getByText("Change Password"));
    await fireEvent.press(screen.getByText("Terms of Use"));
    await fireEvent.press(screen.getByText("Privacy Policy"));
    expect(onChangeEmail).toHaveBeenCalledTimes(1);
    expect(onChangePassword).toHaveBeenCalledTimes(1);
    expect(onOpenUrl).toHaveBeenNthCalledWith(1, "https://example.com/terms");
    expect(onOpenUrl).toHaveBeenNthCalledWith(2, "https://example.com/privacy");
  });

  it("opens Send Feedback from the Support section", async () => {
    const onSendFeedback = jest.fn();
    const screen = await render(<ProfileScreen onSendFeedback={onSendFeedback} />);

    expect(screen.getByText("Support")).toBeTruthy();
    await fireEvent.press(screen.getByText("Send Feedback"));
    expect(onSendFeedback).toHaveBeenCalledTimes(1);
  });
});
