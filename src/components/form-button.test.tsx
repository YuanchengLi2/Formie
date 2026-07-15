import { fireEvent, render } from "@testing-library/react-native";

import { FormButton } from "./form-button";

describe("FormButton", () => {
  it("invokes the primary action once", async () => {
    const onPress = jest.fn();
    const view = await render(<FormButton label="Record Set" onPress={onPress} />);
    await fireEvent.press(view.getByText("Record Set"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not invoke a disabled action", async () => {
    const onPress = jest.fn();
    const view = await render(<FormButton label="Begin Recording" onPress={onPress} disabled />);
    await fireEvent.press(view.getByText("Begin Recording"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
