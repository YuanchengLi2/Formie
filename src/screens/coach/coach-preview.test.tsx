import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CoachPreviewScreen } from "./coach-preview";

describe("CoachPreviewScreen", () => {
  it("is an honest static preview with no simulated product controls", async () => {
    const screen = await render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}><CoachPreviewScreen /></SafeAreaProvider>);

    expect(screen.getByText("Preview — not included in Formie Pro yet")).toBeTruthy();
    expect(screen.getByTestId("coach-preview-card")).toBeTruthy();
    expect(screen.queryByText("Choose a set")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByLabelText(/chat|picker/i)).toBeNull();
  });
});
