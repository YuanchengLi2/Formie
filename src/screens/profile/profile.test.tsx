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

  it("stages athlete and capture edits until Apply Settings", async () => {
    const onSaveProfile = jest.fn().mockResolvedValue(undefined);
    const onSaveCapturePreferences = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen displayName="Yuan" capturePreferences={{ countdownSeconds: 10, hapticsEnabled: true }} onSaveProfile={onSaveProfile} onSaveCapturePreferences={onSaveCapturePreferences} />);
    await fireEvent.changeText(screen.getByLabelText("Display name"), "Yuan Cheng");
    await fireEvent.press(screen.getByText("15 sec"));
    await fireEvent(screen.getByLabelText("Start haptics"), "valueChange", false);
    expect(onSaveProfile).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Apply Settings"));
    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ displayName: "Yuan Cheng" }));
    expect(onSaveCapturePreferences).toHaveBeenCalledWith({ countdownSeconds: 15, hapticsEnabled: false });
  });

  it("keeps apply retryable and logout available", async () => {
    const onSaveProfile = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const onLogOut = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<ProfileScreen onSaveProfile={onSaveProfile} onLogOut={onLogOut} />);
    await fireEvent.press(screen.getByText("Apply Settings"));
    await waitFor(() => expect(screen.getByText("Settings could not be applied. Try again.")).toBeTruthy());
    await fireEvent.press(screen.getByText("Apply Settings"));
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
});
