/* eslint-disable @typescript-eslint/no-require-imports, import/first */
import { fireEvent, render } from "@testing-library/react-native";

const mockDispatch = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    Stack: {
      Screen: ({ options }: { options: { headerRight?: () => React.ReactNode } }) => (
        <>{options.headerRight?.()}</>
      ),
    },
    useLocalSearchParams: () => ({}),
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
  };
});

jest.mock("@/features/analysis/exercise-catalog", () => ({
  searchExerciseCatalog: jest.fn(async () => []),
}));

jest.mock("@/features/capture/capture-store", () => ({
  useCaptureStore: (selector: (state: unknown) => unknown) => selector({
    exerciseChoice: { kind: "unselected" },
    dispatch: mockDispatch,
  }),
}));

jest.mock("@/screens/exercise-selection", () => {
  const { Pressable: MockPressable, Text: MockText } = require("react-native");
  return {
    ExerciseSelectionScreen: ({
      onSelect,
      onGenerateCustomGuide,
    }: {
      onSelect: (exercise: unknown) => void;
      onGenerateCustomGuide: (name: string) => void;
    }) => (
      <>
        <MockText>exercise-selection-screen</MockText>
        <MockPressable
          accessibilityLabel="Select catalog exercise"
          onPress={() => onSelect({
            id: 88,
            name: "One-Arm Dumbbell Row",
            family: "row",
            aliases: [],
            mechanics: { laterality: "unilateral" },
          })}
        />
        <MockPressable
          accessibilityLabel="Use custom exercise"
          onPress={() => onGenerateCustomGuide("Jefferson curl")}
        />
      </>
    ),
  };
});

import ExerciseSelectionRoute from "@/app/exercise-selection";

describe("ExerciseSelectionRoute", () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  it("requires an exercise and sends catalog or custom choices to setup", async () => {
    const screen = await render(<ExerciseSelectionRoute />);

    expect(screen.queryByLabelText("Skip")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Select catalog exercise"));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "exercise_selected",
      exercise: {
        catalogExerciseId: 88,
        canonicalName: "One-Arm Dumbbell Row",
        mechanics: { laterality: "unilateral" },
      },
    });
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/exercise-guide", params: {} });

    await fireEvent.press(screen.getByLabelText("Use custom exercise"));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "exercise_customized",
      canonicalName: "Jefferson curl",
    });
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/exercise-guide", params: {} });
  });
});
