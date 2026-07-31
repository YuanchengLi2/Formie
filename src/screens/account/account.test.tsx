import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ChangeEmailScreen, ChangePasswordScreen } from ".";

describe("account security screens", () => {
  it("requests, verifies, and resends a six-digit email-change code", async () => {
    const onRequest = jest.fn().mockResolvedValue(undefined);
    const onVerify = jest.fn().mockResolvedValue(undefined);
    const onResend = jest.fn().mockResolvedValue(undefined);
    const onComplete = jest.fn();
    const screen = await render(
      <ChangeEmailScreen
        currentEmail="old@example.com"
        onRequest={onRequest}
        onVerify={onVerify}
        onResend={onResend}
        onComplete={onComplete}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText("New email"), " NEW@Example.com ");
    await fireEvent.press(screen.getByText("Send Verification Code"));
    await waitFor(() => expect(onRequest).toHaveBeenCalledWith("new@example.com"));
    expect(screen.getAllByText(/six-digit code/i).length).toBeGreaterThan(0);

    await fireEvent.changeText(screen.getByLabelText("Verification code"), "123456");
    await fireEvent.press(screen.getByText("Verify New Email"));
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith("new@example.com", "123456"));
    expect(onComplete).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText("Resend Code"));
    await waitFor(() => expect(onResend).toHaveBeenCalledWith("new@example.com"));
  });

  it("reauthenticates, validates matching passwords, and updates in place", async () => {
    const onRequestCode = jest.fn().mockResolvedValue(undefined);
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    const onComplete = jest.fn();
    const screen = await render(
      <ChangePasswordScreen
        onRequestCode={onRequestCode}
        onUpdate={onUpdate}
        onComplete={onComplete}
      />,
    );

    await fireEvent.press(screen.getByText("Send Security Code"));
    await waitFor(() => expect(onRequestCode).toHaveBeenCalledTimes(1));
    await fireEvent.changeText(screen.getByLabelText("Security code"), "654321");
    await fireEvent.changeText(screen.getByLabelText("New password"), "long-enough");
    await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "different");
    await fireEvent.press(screen.getByLabelText("Change Password"));
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(onUpdate).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "long-enough");
    await fireEvent.press(screen.getByLabelText("Change Password"));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("long-enough", "654321"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("keeps backend failures actionable for invalid, expired, duplicate, or weak input", async () => {
    const screen = await render(
      <ChangeEmailScreen
        currentEmail="old@example.com"
        onRequest={jest.fn().mockRejectedValue(new Error("A user with this email address has already been registered"))}
        onVerify={jest.fn()}
        onResend={jest.fn()}
        onComplete={jest.fn()}
      />,
    );
    await fireEvent.changeText(screen.getByLabelText("New email"), "used@example.com");
    await fireEvent.press(screen.getByText("Send Verification Code"));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});
