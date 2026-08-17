import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Keyboard } from "react-native";

import type { CatalogExercise } from "@/features/analysis/exercise-catalog";

import { ExerciseSelectionScreen } from "./index";

const row: CatalogExercise = {
  id: 88,
  name: "One-Arm Dumbbell Row",
  family: "row",
  aliases: ["Single-Arm Dumbbell Row"],
  mechanics: { laterality: "unilateral", equipmentClass: "dumbbell" },
};

describe("ExerciseSelectionScreen", () => {
  it("dismisses the search keyboard when the user starts scrolling", async () => {
    const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
    const screen = await render(
      <ExerciseSelectionScreen
        onSearch={jest.fn(async () => [])}
        onSelect={jest.fn()}
        onGenerateCustomGuide={jest.fn()}
      />,
    );

    fireEvent(screen.getByTestId("exercise-selection-scroll"), "scrollBeginDrag");

    expect(dismiss).toHaveBeenCalledTimes(1);
    dismiss.mockRestore();
  });

  it("searches the catalog and returns the canonical selected exercise", async () => {
    const onSelect = jest.fn();
    const onSearch = jest.fn(async () => [row]);
    const screen = await render(
      <ExerciseSelectionScreen
        onSearch={onSearch}
        onSelect={onSelect}
        onGenerateCustomGuide={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Search exercises"), "single arm row");
      await new Promise((resolve) => setTimeout(resolve, 220));
    });
    await waitFor(() => expect(screen.getByText("One-Arm Dumbbell Row")).toBeTruthy());
    expect(screen.queryByTestId("exercise-hero-section")).toBeNull();
    fireEvent.press(screen.getByLabelText("Select One-Arm Dumbbell Row"));
    await waitFor(() => expect(screen.queryByLabelText("Searching exercises")).toBeNull());

    expect(onSelect).toHaveBeenCalledWith(row);
  });

  it("keeps Skip out of the scrolling screen content", async () => {
    const screen = await render(
      <ExerciseSelectionScreen
        onSearch={jest.fn(async () => [])}
        onSelect={jest.fn()}
        onGenerateCustomGuide={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText("Skip")).toBeNull();
  });

  it("keeps catalog results on Choose Exercise and analyzes an unmatched input as custom", async () => {
    const onGenerateCustomGuide = jest.fn();
    const screen = await render(
      <ExerciseSelectionScreen
        onSearch={jest.fn(async () => [])}
        onSelect={jest.fn()}
        onGenerateCustomGuide={onGenerateCustomGuide}
      />,
    );

    expect(screen.queryByText("Choose Exercise")).toBeNull();
    expect(screen.getByText("Choose your exercise before recording")).toBeTruthy();
    expect(screen.getByLabelText("Bench press exercise illustration")).toBeTruthy();
    expect(screen.getByTestId("exercise-hero")).toHaveStyle({
      height: 340,
      backgroundColor: "transparent",
    });
    expect(screen.getByTestId("exercise-helper")).toHaveStyle({
      fontSize: 22,
      textAlign: "center",
    });
    expect(screen.getByTestId("exercise-hero-image")).toHaveStyle({
      opacity: 0.35,
      transform: [{ translateY: 28 }],
    });
    const search = screen.getByTestId("exercise-search");
    const heroSection = screen.getByTestId("exercise-hero-section");
    expect(search.parent).toBe(heroSection.parent);
    expect(search.parent!.children.indexOf(search)).toBeLessThan(search.parent!.children.indexOf(heroSection));

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Search exercises"), "Jefferson curl");
      await new Promise((resolve) => setTimeout(resolve, 220));
    });

    expect(screen.queryByTestId("exercise-hero-section")).toBeNull();
    expect(screen.getByText("No exact match")).toBeTruthy();
    expect(screen.getByText('Use “Jefferson curl”')).toBeTruthy();
    expect(screen.getByText("Formie will use this exercise name to create your setup guide before you record.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Use Jefferson curl for setup"));
    expect(onGenerateCustomGuide).toHaveBeenCalledWith("Jefferson curl");
  });

  it("offers the typed exercise when fuzzy catalog suggestions do not exactly match it", async () => {
    const fuzzyResult: CatalogExercise = {
      id: 301,
      name: "Single Arm Dumbbell Overhead Triceps Extension",
      family: "triceps",
      aliases: ["One Arm Dumbbell Triceps Extension"],
      mechanics: { laterality: "unilateral", equipmentClass: "dumbbell" },
    };
    const screen = await render(
      <ExerciseSelectionScreen
        onSearch={jest.fn(async () => [fuzzyResult])}
        onSelect={jest.fn()}
        onGenerateCustomGuide={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Search exercises"), "seated one arm dumbbell extensions");
      await new Promise((resolve) => setTimeout(resolve, 220));
    });

    await waitFor(() => expect(screen.getByText(fuzzyResult.name)).toBeTruthy());
    expect(screen.getByLabelText("Use seated one arm dumbbell extensions for setup")).toBeTruthy();
  });

  it("keeps a typed custom exercise selectable when the remote catalog is unavailable", async () => {
    const onGenerateCustomGuide = jest.fn();
    const screen = await render(
      <ExerciseSelectionScreen
        onSearch={jest.fn(async () => { throw new Error("network unavailable"); })}
        onSelect={jest.fn()}
        onGenerateCustomGuide={onGenerateCustomGuide}
      />,
    );

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Search exercises"), "Jefferson curl");
      await new Promise((resolve) => setTimeout(resolve, 220));
    });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/i));
    fireEvent.press(screen.getByLabelText("Use Jefferson curl for setup"));
    expect(onGenerateCustomGuide).toHaveBeenCalledWith("Jefferson curl");
  });

  it.each([
    ["One-Arm Dumbbell Row"],
    ["single arm dumbbell row"],
  ])("does not offer a custom exercise for exact catalog name or alias %s", async (query) => {
    const screen = await render(
      <ExerciseSelectionScreen
        onSearch={jest.fn(async () => [row])}
        onSelect={jest.fn()}
        onGenerateCustomGuide={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Search exercises"), query);
      await new Promise((resolve) => setTimeout(resolve, 220));
    });

    await waitFor(() => expect(screen.getByText("One-Arm Dumbbell Row")).toBeTruthy());
    expect(screen.queryByLabelText(`Use ${query} for setup`)).toBeNull();
  });
});
