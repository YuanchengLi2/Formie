import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AccountAccessScreen } from "@/components/account-access-screen";
import { SocialLoginScreen } from ".";

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function withSafeArea(node: React.ReactNode) {
  return <SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>;
}

describe("account access screens", () => {
  it("renders a distinct logged-out screen with a gold bar, email login, and Create New Account", async () => {
    const onOAuth = jest.fn();
    const onEmail = jest.fn();
    const onCreateAccount = jest.fn();
    const screen = await render(withSafeArea(<SocialLoginScreen onOAuth={onOAuth} onEmail={onEmail} onCreateAccount={onCreateAccount} busyProvider={null} />));

    expect(screen.getByTestId("account-access-gold-bar")).toBeTruthy();
    expect(screen.getByTestId("account-access-gold-bar")).toHaveStyle({ height: 4 });
    expect(screen.queryByLabelText("Formie")).toBeNull();
    expect(screen.getByText("Welcome back. Your coaching history is ready when you are.")).toBeTruthy();
    expect(screen.queryByText(/Create or restore|profile stays private/i)).toBeNull();
    expect(screen.getByText("Sign in with Apple")).toBeTruthy();
    expect(screen.getByText("Sign in with Google")).toBeTruthy();
    expect(screen.getByText("Sign in with Email")).toBeTruthy();
    expect(screen.getByText("Create New Account")).toBeTruthy();
    expect(screen.getByTestId("account-access-scroll")).toBeTruthy();

    await fireEvent.press(screen.getByText("Create New Account"));
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
  });

  it("requires both real consent checkboxes before any provider can continue", async () => {
    const onOAuth = jest.fn();
    const onEmail = jest.fn();
    const screen = await render(withSafeArea(<SocialLoginScreen onOAuth={onOAuth} onEmail={onEmail} onCreateAccount={jest.fn()} busyProvider={null} />));

    const apple = screen.getByLabelText("Sign in with Apple");
    expect(apple.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(apple);
    expect(onOAuth).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText("Agree to the Terms of Use"));
    expect(screen.getByLabelText("Agree to the Terms of Use").props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText("Sign in with Google").props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByLabelText("Acknowledge the Privacy Policy"));
    expect(screen.getByLabelText("Acknowledge the Privacy Policy").props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByText("Sign in with Google"));
    await fireEvent.press(screen.getByText("Sign in with Email"));
    expect(onOAuth).toHaveBeenCalledWith("google");
    expect(onEmail).toHaveBeenCalledTimes(1);
  });

  it("uses the thin accent, compact controls, and safe touch targets on the save-account screen", async () => {
    const screen = await render(withSafeArea(
      <AccountAccessScreen
        mode="onboarding"
        personalizedMessage="Save your account so Formie can keep coaching you toward your first 225 lb bench."
        onOAuth={jest.fn()}
        onEmail={jest.fn()}
        busyProvider={null}
      />,
    ));

    expect(screen.getByText("Save your account")).toBeTruthy();
    expect(screen.getByText(/225 lb bench/)).toBeTruthy();
    expect(screen.getByText("Save your account with Apple")).toBeTruthy();
    expect(screen.getByText("Save your account with Google")).toBeTruthy();
    expect(screen.getByText("Save your account with Email")).toBeTruthy();
    expect(screen.queryByText("Create New Account")).toBeNull();
    expect(screen.getByTestId("account-access-gold-bar")).toHaveStyle({ height: 4 });
    expect(screen.getByTestId("provider-apple")).toHaveStyle({ minHeight: 50 });
    expect(screen.getByTestId("social-provider-buttons")).toHaveStyle({ gap: 15 });
    expect(screen.getAllByTestId("account-access-checkbox")[0]).toHaveStyle({ width: 22, height: 22 });
    expect(screen.getByLabelText("Formie")).toHaveStyle({ width: 82, height: 82 });
  });
});
