import { act, fireEvent, render } from "@testing-library/react-native";

import { AgeRestrictedScreen } from "./index";

describe("AgeRestrictedScreen", () => {
  it("blocks product access while preserving account controls", async () => {
    const screen = await render(
      <AgeRestrictedScreen
        onContactSupport={jest.fn()}
        onDeleteAccount={jest.fn()}
        onLogOut={jest.fn()}
        onManageSubscription={jest.fn()}
      />,
    );

    expect(screen.getByText(/18 or older/)).toBeTruthy();
    expect(screen.getByLabelText("Manage Apple subscription")).toBeTruthy();
    expect(screen.getByLabelText("Contact Formie support")).toBeTruthy();
    expect(screen.getByLabelText("Delete account")).toBeTruthy();
    expect(screen.getByLabelText("Log out")).toBeTruthy();
    expect(screen.queryByLabelText(/record/i)).toBeNull();
    expect(screen.queryByLabelText(/purchase/i)).toBeNull();
  }, 15_000);

  it("requires DELETE before permanent account deletion", async () => {
    const onDeleteAccount = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <AgeRestrictedScreen
        onContactSupport={jest.fn()}
        onDeleteAccount={onDeleteAccount}
        onLogOut={jest.fn()}
        onManageSubscription={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByLabelText("Delete account"));
    expect(screen.getByLabelText("Confirm account deletion").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    await fireEvent.press(screen.getByLabelText("Confirm account deletion"));
    await act(async () => {});
    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });
});
