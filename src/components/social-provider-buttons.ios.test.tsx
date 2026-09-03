/* eslint-disable import/first, @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationButtonStyle: { WHITE: "WHITE" },
  AppleAuthenticationButtonType: { SIGN_IN: "SIGN_IN", SIGN_UP: "SIGN_UP" },
  AppleAuthenticationButton: ({ onPress, testID, ...props }: { onPress: () => void; testID: string }) => {
    const React = require("react");
    const { Pressable, Text } = require("react-native");
    return React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: "Sign in with Apple", onPress, testID, ...props }, React.createElement(Text, null, "Sign in with Apple"));
  },
}));

import { SocialProviderButtons } from "./social-provider-buttons.ios";

describe("iOS social provider buttons", () => {
  it("uses Apple's official control and does not advertise unsupported Google sign-in", async () => {
    const onApple = jest.fn();
    const screen = await render(<SocialProviderButtons onApple={onApple} />);

    const apple = screen.getByTestId("provider-apple");
    expect(apple).toHaveProp("buttonStyle", "WHITE");
    expect(apple).toHaveProp("buttonType", "SIGN_IN");
    expect(screen.queryByText(/Google/i)).toBeNull();

    fireEvent.press(apple);
    expect(onApple).toHaveBeenCalledTimes(1);
  });

  it("uses Apple's sign-up control when creating an account", async () => {
    const screen = await render(<SocialProviderButtons intent="create_account" onApple={jest.fn()} />);

    expect(screen.getByTestId("provider-apple")).toHaveProp("buttonType", "SIGN_UP");
  });

  it("keeps loading and errors outside the official Apple control", async () => {
    const screen = await render(<SocialProviderButtons onApple={jest.fn()} busy error="Apple sign-in needs to be retried." />);

    expect(screen.getByTestId("provider-apple-wrapper")).toBeDisabled();
    expect(screen.getByText("Connecting to Apple…")).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent("Apple sign-in needs to be retried.");
  });
});
