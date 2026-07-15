import { fireEvent, render } from "@testing-library/react-native";

import { HomeScreen } from "./index";

describe("HomeScreen", () => {
  it("centers the experience on recording without exercise selection", async () => {
    const onRecord = jest.fn();
    const screen = await render(<HomeScreen onRecord={onRecord} />);

    expect(screen.getByText("Record an Exercise")).toBeTruthy();
    expect(screen.queryByText("Search exercises")).toBeNull();
    expect(screen.queryByText("Choose Exercise")).toBeNull();

    await fireEvent.press(screen.getByText("Record an Exercise"));
    expect(onRecord).toHaveBeenCalledTimes(1);
  });

  it("explains that recognition happens automatically", async () => {
    const screen = await render(<HomeScreen onRecord={jest.fn()} />);
    expect(screen.getByText("Record any movement. FORM identifies it and coaches what it can actually see.")).toBeTruthy();
  });
});
