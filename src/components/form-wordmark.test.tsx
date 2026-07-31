import { render } from "@testing-library/react-native";

import { FormWordmark } from "./form-wordmark";

describe("FormWordmark", () => {
  it("uses the supplied cropped logo at the profile-button size", async () => {
    const screen = await render(<FormWordmark />);

    expect(screen.getByLabelText("Formie logo")).toBeTruthy();
    expect(screen.getByLabelText("Formie logo")).toHaveStyle({ width: 44, height: 44 });
    expect(screen.queryByText("Formie")).toBeNull();
  });
});
