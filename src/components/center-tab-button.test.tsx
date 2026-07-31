import { fireEvent, render } from "@testing-library/react-native";

import { CenterTabButton } from "./center-tab-button";

describe("CenterTabButton", () => {
  it("always shows the permanent Record action and visible label", async () => {
    const onPress = jest.fn();
    const screen = await render(<CenterTabButton onPress={onPress} />);
    expect(screen.getByLabelText("Record")).toBeTruthy();
    expect(screen.getByText("Record")).toBeTruthy();
    expect(screen.queryByText("Upgrade")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Record"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses a compact 56 point raised gold action without resizing other tabs", async () => {
    const screen = await render(<CenterTabButton onPress={jest.fn()} />);
    expect(screen.getByTestId("center-tab-circle")).toHaveStyle({
      width: 56,
      height: 56,
      borderRadius: 28,
    });
  });
});
