import { act, fireEvent, render } from "@testing-library/react-native";

import { ForgotPasswordScreen, LoginScreen, ResetPasswordScreen, SignUpScreen, VerifyEmailScreen } from ".";

describe("authentication screens", () => {
  it("validates login and submits normalized credentials once", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<LoginScreen onSubmit={onSubmit} onCreateAccount={jest.fn()} onForgotPassword={jest.fn()} />);

    await fireEvent.press(screen.getByText("Log In"));
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("Email"), " USER@Example.COM ");
    await fireEvent.changeText(screen.getByLabelText("Password"), "long-enough");
    expect(screen.getByLabelText("Password").props.autoCapitalize).toBe("none");
    await fireEvent.press(screen.getByText("Log In"));
    expect(onSubmit).toHaveBeenCalledWith("user@example.com", "long-enough");
  });

  it("shows a successful password-reset notice separately from errors", async () => {
    const screen = await render(
      <LoginScreen
        initialNotice="Password updated. Log in with your new password."
        onSubmit={jest.fn()}
        onCreateAccount={jest.fn()}
        onForgotPassword={jest.fn()}
      />,
    );

    expect(screen.getByText("Password updated. Log in with your new password.")).toBeTruthy();
    expect(screen.getByTestId("auth-notice")).toBeTruthy();
  });

  it("shows friendly login errors without leaking backend details", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("Invalid login credentials"));
    const screen = await render(<LoginScreen onSubmit={onSubmit} onCreateAccount={jest.fn()} onForgotPassword={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "long-enough");
    await fireEvent.press(screen.getByText("Log In"));
    expect(await screen.findByText("The email or password is incorrect.")).toBeTruthy();
    expect(screen.queryByText("Invalid login credentials")).toBeNull();
  });

  it("creates a standard account only after passwords match", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <SignUpScreen
        onSubmit={onSubmit}
        onBackToLogin={jest.fn()}
        onOpenTerms={jest.fn()}
        onOpenPrivacy={jest.fn()}
      />,
    );
    await fireEvent.changeText(screen.getByLabelText("Name"), "Yuan Cheng");
    await fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "long-enough");
    await fireEvent.changeText(screen.getByLabelText("Confirm password"), "different");
    await fireEvent.press(screen.getByText("Create Account"));
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(screen.getByText("Agree to the Terms of Service and Privacy Policy.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText("Confirm password"), "long-enough");
    await fireEvent.press(screen.getByLabelText("Agree to Terms of Service and Privacy Policy"));
    await fireEvent.press(screen.getByText("Create Account"));
    expect(onSubmit).toHaveBeenCalledWith({
      displayName: "Yuan Cheng",
      email: "user@example.com",
      password: "long-enough",
      legalAcceptedAt: expect.any(String),
    });
    expect(await screen.findByText("Account created. Your 6-digit email-code request was accepted.")).toBeTruthy();
  });

  it("has one signup form with name, email, password, and confirmation", async () => {
    const screen = await render(
      <SignUpScreen
        onSubmit={jest.fn()}
        onBackToLogin={jest.fn()}
        onOpenTerms={jest.fn()}
        onOpenPrivacy={jest.fn()}
      />,
    );
    expect(screen.getByText("Create your account")).toBeTruthy();
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByLabelText("Confirm password")).toBeTruthy();
    expect(screen.queryByText("Keep your recordings")).toBeNull();
    expect(screen.queryByText("Verify Email")).toBeNull();
  });

  it("opens both configured legal documents from signup", async () => {
    const onOpenTerms = jest.fn().mockResolvedValue(undefined);
    const onOpenPrivacy = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <SignUpScreen
        onSubmit={jest.fn()}
        onBackToLogin={jest.fn()}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
      />,
    );
    await fireEvent.press(screen.getByText("Terms of Service"));
    await fireEvent.press(screen.getByText("Privacy Policy"));
    expect(onOpenTerms).toHaveBeenCalled();
    expect(onOpenPrivacy).toHaveBeenCalled();
  });

  it("offers verification recovery actions without exposing the full email", async () => {
    const onResend = jest.fn().mockResolvedValue(undefined);
    const onVerifyCode = jest.fn().mockResolvedValue(undefined);
    const onChangeEmail = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<VerifyEmailScreen email="user@example.com" type="signup" onResend={onResend} onVerifyCode={onVerifyCode} onChangeEmail={onChangeEmail} />);
    expect(screen.getByText(/u\*\*\*@example\.com/)).toBeTruthy();
    expect(screen.queryByText("user@example.com")).toBeNull();
    expect(screen.getByTestId("verification-content").props.contentContainerStyle).toEqual(
      expect.objectContaining({ flexGrow: 1, justifyContent: "center" }),
    );
    for (let index = 0; index < 6; index += 1) {
      expect(screen.getByTestId(`verification-code-box-${index}`)).toBeTruthy();
    }
    await fireEvent.press(screen.getByText("Verify Code"));
    expect(screen.getByText("Enter the 6-digit code from your email.")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Verification code"), "12 34-56");
    await fireEvent.press(screen.getByText("Verify Code"));
    expect(onVerifyCode).toHaveBeenCalledWith("123456");
    expect(await screen.findByText("Email verified. Continuing to Formie.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Use a different email"));
    expect(onChangeEmail).toHaveBeenCalled();
  });

  it("shows a resend error that arrives after the verification screen opens", async () => {
    const props = {
      email: "user@example.com",
      type: "signup" as const,
      onResend: jest.fn().mockResolvedValue(undefined),
      onVerifyCode: jest.fn().mockResolvedValue(undefined),
      onChangeEmail: jest.fn().mockResolvedValue(undefined),
    };
    const screen = await render(<VerifyEmailScreen {...props} callbackError={null} />);
    expect(screen.queryByText(/could not be sent yet/i)).toBeNull();

    await act(async () => {
      screen.rerender(
        <VerifyEmailScreen
          {...props}
          callbackError="Your email isn't verified. A new code could not be sent yet. Use Resend Code to try again."
        />,
      );
    });
    expect(await screen.findByText(/could not be sent yet.*Resend Code/i)).toBeTruthy();
  });

  it("reports exactly what succeeded for recovery without claiming an account exists", async () => {
    const onRequest = jest.fn().mockResolvedValue(undefined);
    const forgot = await render(<ForgotPasswordScreen onSubmit={onRequest} onBackToLogin={jest.fn()} />);
    await fireEvent.changeText(forgot.getByLabelText("Email"), "user@example.com");
    await fireEvent.press(forgot.getByText("Send Reset Code"));
    expect(await forgot.findByText(/Reset request accepted.*check your inbox and spam/i)).toBeTruthy();
    expect(forgot.queryByText(/an account exists/i)).toBeNull();

    const verify = await render(
      <VerifyEmailScreen
        email="user@example.com"
        type="recovery"
        onResend={jest.fn()}
        onVerifyCode={jest.fn()}
        onChangeEmail={jest.fn()}
      />,
    );
    expect(verify.getByText(/Request accepted for u\*\*\*@example\.com/i)).toBeTruthy();
    expect(verify.getByText(/Enter the 6-digit code from your inbox or spam folder/i)).toBeTruthy();
  });

  it("validates the new recovery password", async () => {
    const onReset = jest.fn().mockResolvedValue(undefined);
    const reset = await render(<ResetPasswordScreen onSubmit={onReset} />);
    await fireEvent.changeText(reset.getByLabelText("New password"), "long-enough");
    await fireEvent.changeText(reset.getByLabelText("Confirm new password"), "different");
    await fireEvent.press(reset.getByText("Update Password"));
    expect(reset.getByText("Passwords do not match.")).toBeTruthy();
    expect(onReset).not.toHaveBeenCalled();

    await fireEvent.changeText(reset.getByLabelText("Confirm new password"), "long-enough");
    await fireEvent.press(reset.getByText("Update Password"));
    expect(await reset.findByText("Password updated. You can now log in with your new password.")).toBeTruthy();
  });
});
