import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AccountAccessScreen, isCompactAccountAccessLayout } from "@/components/account-access-screen";
import { SocialLoginScreen } from ".";

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function withSafeArea(node: React.ReactNode) {
  return <SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>;
}

describe("account access screens", () => {
  it("matches the approved white account-access reference on login", async () => {
    const onOAuth = jest.fn();
    const onCreateAccount = jest.fn();
    const screen = await render(withSafeArea(<SocialLoginScreen onOAuth={onOAuth} onCreateAccount={onCreateAccount} busyProvider={null} />));

    expect(screen.getByTestId("account-access-top-row")).toBeTruthy();
    expect(screen.getByTestId("social-account-access")).toHaveStyle({ backgroundColor: "#050505" });
    expect(screen.getByTestId("account-access-gold-bar")).toHaveStyle({ height: 3, backgroundColor: "#E5AD32" });
    expect(screen.queryByLabelText("Formie")).toBeNull();
    expect(screen.queryByText("Welcome back. Your coaching history is ready when you are.")).toBeNull();
    expect(screen.queryByText(/Create or restore|profile stays private/i)).toBeNull();
    expect(screen.getByText("Sign in with Apple")).toBeTruthy();
    expect(screen.queryByText("Sign in with Google")).toBeNull();
    expect(screen.queryByText("Sign in with Email")).toBeNull();
    expect(screen.queryByText("Coming soon")).toBeNull();
    expect(screen.getByText("Create New Account")).toBeTruthy();
    expect(screen.getByTestId("account-access-scroll")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId("account-access-scroll").props.contentContainerStyle)).toMatchObject({
      width: "100%",
      maxWidth: 560,
      paddingHorizontal: 24,
      paddingBottom: 50,
    });
    expect(screen.getByTestId("provider-apple")).toHaveStyle({ minHeight: 58, backgroundColor: "#E5AD32" });
    expect(screen.queryByTestId("provider-google")).toBeNull();
    expect(screen.queryByTestId("provider-email")).toBeNull();

    await fireEvent.press(screen.getByText("Create New Account"));
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
  });

  it("shows Apple as the only production sign-in action", async () => {
    const onOAuth = jest.fn();
    const screen = await render(withSafeArea(<SocialLoginScreen onOAuth={onOAuth} onCreateAccount={jest.fn()} busyProvider={null} />));

    const apple = screen.getByLabelText("Sign in with Apple");
    expect(apple.props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(apple);
    expect(onOAuth).toHaveBeenCalledWith("apple");
    expect(screen.queryByLabelText("Agree to the Terms of Use")).toBeNull();
    expect(screen.queryByLabelText("Acknowledge the Privacy Policy")).toBeNull();
    expect(screen.queryByLabelText(/Google|Email|Coming soon/i)).toBeNull();
  });

  it("announces confirmed account deletion without claiming Apple authorization was revoked", async () => {
    const screen = await render(withSafeArea(
      <SocialLoginScreen
        onOAuth={jest.fn()}
        onCreateAccount={jest.fn()}
        busyProvider={null}
        notice="Your Formie account was deleted."
      />,
    ));

    const notice = screen.getByText("Your Formie account was deleted.");
    expect(notice.props.accessibilityLiveRegion).toBe("polite");
  });

  it("matches the approved white save-progress reference", async () => {
    const screen = await render(withSafeArea(
      <AccountAccessScreen
        mode="onboarding"
        personalizedMessage="Save your account so Formie can keep coaching you toward your first 225 lb bench."
        onOAuth={jest.fn()}
        busyProvider={null}
      />,
    ));

    expect(screen.getByText("Save your progress")).toBeTruthy();
    expect(screen.queryByText(/225 lb bench/)).toBeNull();
    expect(screen.getByText("Sign in with Apple")).toBeTruthy();
    expect(screen.queryByText("Sign in with Google")).toBeNull();
    expect(screen.queryByText("Continue with email")).toBeNull();
    expect(screen.queryByText("Create New Account")).toBeNull();
    expect(screen.getByTestId("social-account-access")).toHaveStyle({ backgroundColor: "#050505" });
    expect(screen.getByTestId("account-access-gold-bar")).toHaveStyle({ height: 3, backgroundColor: "#E5AD32" });
    expect(screen.getByTestId("provider-apple")).toHaveStyle({ backgroundColor: "#E5AD32" });
    expect(screen.getByTestId("account-access-top-row")).toHaveStyle({ flexDirection: "row", gap: 14 });
    expect(screen.getByTestId("account-access-actions")).toHaveStyle({ width: "100%", maxWidth: 296, alignSelf: "center", marginTop: 116 });
    expect(screen.getByTestId("provider-apple")).toHaveStyle({ minHeight: 58 });
    expect(screen.getByTestId("social-provider-buttons")).toHaveStyle({ gap: 22 });
    const legalCheckbox = screen.getByLabelText("Agree to the Terms of Use and Privacy Policy");
    expect(legalCheckbox).toHaveStyle({ width: 18, height: 18, backgroundColor: "#050505" });
    await fireEvent.press(legalCheckbox);
    expect(legalCheckbox).toHaveStyle({ width: 18, height: 18, backgroundColor: "#E5AD32" });
    expect(screen.getByText(/I agree to Formie's Terms of Use and Privacy Policy/)).toBeTruthy();
    expect(screen.getByText(/Send me tips, new features/)).toBeTruthy();
    expect(screen.queryByLabelText("Formie")).toBeNull();
  });

  it("uses compact spacing on short and narrow phones", () => {
    expect(isCompactAccountAccessLayout(568, 320, 20, 0)).toBe(true);
    expect(isCompactAccountAccessLayout(844, 390, 47, 34)).toBe(false);
  });
});
