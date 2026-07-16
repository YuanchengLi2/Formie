import { render } from "@testing-library/react-native";

import { ProfileScreen } from ".";

describe("ProfileScreen", () => {
  it("uses the concise production sections without the redundant analysis explainer", async () => {
    const screen = await render(<ProfileScreen />);

    expect(screen.getByText("Private by default")).toBeTruthy();
    expect(screen.queryByText("How FORM analyzes")).toBeNull();
    expect(screen.queryByText(/Gemini reviews the complete recording/i)).toBeNull();
    expect(screen.getByLabelText("Private by default")).toBeTruthy();
    expect(screen.queryByLabelText("Complete-video analysis")).toBeNull();
    expect(screen.queryByText("HOW FORM WORKS")).toBeNull();
    expect(screen.queryByText(/MediaPipe/i)).toBeNull();
  });
});
