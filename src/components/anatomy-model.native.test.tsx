import { render } from "@testing-library/react-native";

import { AnatomyModel } from "./anatomy-model.native";

describe("native AnatomyModel", () => {
  it("opens saved analysis anatomy without mounting an Expo GL surface", async () => {
    const screen = await render(
      <AnatomyModel
        targetRegions={["chest"]}
        secondaryRegions={["triceps"]}
        issueRegions={["shoulders"]}
      />,
    );

    expect(screen.getByTestId("anatomy-gesture-surface")).toBeTruthy();
    expect(screen.queryByTestId("anatomy-3d-canvas")).toBeNull();
  });
});
