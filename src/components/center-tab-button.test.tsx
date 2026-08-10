import { fireEvent, render } from "@testing-library/react-native";

import { CenterTabButton } from "./center-tab-button";

describe("CenterTabButton", () => {
  it("shows the requested action and accessible label", async () => {
    const onPress = jest.fn();
    const screen = await render(<CenterTabButton label="Purchase" accessibilityLabel="Purchase subscription" onPress={onPress} />);
    expect(screen.getByLabelText("Purchase subscription")).toBeTruthy();
    expect(screen.getByText("Purchase")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Purchase subscription"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses a compact 56 point raised gold action without resizing other tabs", async () => {
    const screen = await render(<CenterTabButton label="Record" accessibilityLabel="Record" onPress={jest.fn()} />);
    expect(screen.getByTestId("center-tab-circle")).toHaveStyle({
      width: 56,
      height: 56,
      borderRadius: 28,
    });
    expect(screen.getByTestId("center-tab-lens")).toBeTruthy();
    expect(screen.getAllByTestId("center-tab-aperture-blade")).toHaveLength(3);
  });

  it("grays out and disables exhausted Record instead of opening a recording", async () => {
    const onPress = jest.fn();
    const screen = await render(<CenterTabButton variant="quota_exhausted" label="Record" accessibilityLabel="Record. Monthly analysis allowance used" onPress={onPress} />);
    expect(screen.getByLabelText("Record. Monthly analysis allowance used").props.accessibilityState).toEqual({ disabled: true });
    expect(screen.getByTestId("center-tab-circle")).toHaveStyle({ backgroundColor: "#353535" });
    expect(screen.getAllByTestId("center-tab-aperture-blade")).toHaveLength(3);
    await fireEvent.press(screen.getByLabelText("Record. Monthly analysis allowance used"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each([
    ["purchase", "Purchase"],
    ["analysis_pending", "View analysis"],
  ] as const)("keeps the %s action gold instead of using the quota-gray style", async (variant, label) => {
    const screen = await render(<CenterTabButton variant={variant} label={label} onPress={jest.fn()} />);
    expect(screen.getByTestId("center-tab-circle")).not.toHaveStyle({ backgroundColor: "#353535" });
  });
});
