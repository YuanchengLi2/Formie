import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { EmailCodeScreen, EmailEntryScreen, PasswordSignInScreen } from "./email-auth-screens";

const metrics = { frame: { x: 0, y: 0, width: 320, height: 568 }, insets: { top: 20, left: 0, right: 0, bottom: 0 } };
const wrap = (node: React.ReactNode) => <SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>;

describe("Email OTP auth screens", () => {
  it("validates the email entry and submits a normalized address", async () => {
    const onSubmit = jest.fn();
    const screen = await render(wrap(<EmailEntryScreen intent="login" busy={false} error={null} onBack={jest.fn()} onSubmit={onSubmit} />));
    expect(screen.getByTestId("email-auth-scroll")).toBeTruthy();
    expect(screen.getByTestId("email-auth-scroll")).toHaveProp("keyboardShouldPersistTaps", "handled");
    expect(StyleSheet.flatten(screen.getByTestId("email-auth-scroll").props.contentContainerStyle)).toMatchObject({
      width: "100%",
      maxWidth: 560,
      paddingHorizontal: 24,
      paddingBottom: 24,
    });
    await fireEvent.changeText(screen.getByLabelText("Email address"), "not-email");
    await fireEvent.press(screen.getByText("Send my code"));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    await fireEvent.changeText(screen.getByLabelText("Email address"), " Athlete@Example.com ");
    await fireEvent.press(screen.getByText("Send my code"));
    expect(onSubmit).toHaveBeenCalledWith("athlete@example.com");
  });

  it("uses a dedicated six-digit code screen with resend and verification", async () => {
    const onVerify = jest.fn();
    const onResend = jest.fn();
    const screen = await render(wrap(<EmailCodeScreen email="athlete@example.com" intent="onboarding" busy={false} error={null} onBack={jest.fn()} onVerify={onVerify} onResend={onResend} />));
    expect(screen.getByText("Save your account with the code we sent")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Six digit code"), "12a34567");
    expect(screen.getByLabelText("Six digit code").props.value).toBe("123456");
    await fireEvent.press(screen.getByText("Verify and save my account"));
    expect(onVerify).toHaveBeenCalledWith("123456");
    await fireEvent.press(screen.getByText("Send a new code"));
    expect(onResend).toHaveBeenCalledTimes(1);
  });

  it("submits normalized credentials without displaying the password", async () => {
    const onSubmit = jest.fn();
    const screen = await render(wrap(<PasswordSignInScreen busy={false} error={null} onBack={jest.fn()} onSubmit={onSubmit} />));
    const password = screen.getByLabelText("Password");
    expect(password.props.secureTextEntry).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Email address"), " AppReview@Formie.app ");
    await fireEvent.changeText(password, "review-password");
    await fireEvent.press(screen.getByText("Sign in"));
    expect(onSubmit).toHaveBeenCalledWith("appreview@formie.app", "review-password");
  });
});
