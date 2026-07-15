import { fireEvent, render } from "@testing-library/react-native";

import { ExerciseSearchScreen } from "./index";

describe("ExerciseSearchScreen", () => {
  it("filters the launch catalog and selects an exercise", async () => {
    const onSelect = jest.fn();
    const view = await render(<ExerciseSearchScreen onSelect={onSelect} />);

    await fireEvent.changeText(view.getByPlaceholderText("Search exercises"), "curl");

    expect(view.getByText("Standing Dumbbell Curl")).toBeTruthy();
    expect(view.getByText("Hammer Curl")).toBeTruthy();
    expect(view.getByText("Barbell Curl")).toBeTruthy();
    expect(view.getByText("Cable Curl")).toBeTruthy();
    expect(view.getByText("Preacher Curl")).toBeTruthy();

    await fireEvent.press(view.getByText("Standing Dumbbell Curl"));
    expect(onSelect).toHaveBeenCalledWith("standing-dumbbell-curl");
  });

  it("filters by category", async () => {
    const view = await render(<ExerciseSearchScreen onSelect={jest.fn()} />);
    await fireEvent.press(view.getByText("Core"));
    expect(view.getByText("Front Plank")).toBeTruthy();
    expect(view.queryByText("Barbell Bench Press")).toBeNull();
  });
});
