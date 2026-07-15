import { render } from "@testing-library/react-native";

import { ProfileScreen } from ".";

describe("ProfileScreen", () => {
  it("shows truthful privacy and analysis information instead of placeholder copy", async () => {
    const screen = await render(<ProfileScreen />);

    expect(screen.getByText("Private by default")).toBeTruthy();
    expect(screen.getByText("How FORM analyzes")).toBeTruthy();
    expect(screen.getByText(/Gemini reviews the complete recording at up to 24 sampled frames per second/i)).toBeTruthy();
    expect(screen.queryByText(/MediaPipe/i)).toBeNull();
    expect(screen.queryByText("Privacy, retention, and account controls live here.")).toBeNull();
  });
});
