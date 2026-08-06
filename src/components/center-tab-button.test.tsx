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

  it("does not invoke recording while the monthly quota is exhausted", async () => {
    const onPress = jest.fn();
    const screen = await render(<CenterTabButton disabled label="0 analyses left" accessibilityLabel="0 analyses left" onPress={onPress} />);
    expect(screen.getByLabelText("0 analyses left").props.accessibilityState).toEqual({ disabled: true });
    await fireEvent.press(screen.getByLabelText("0 analyses left"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
