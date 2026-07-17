import { render } from "@testing-library/react-native";

import { FormWordmark } from "./form-wordmark";

describe("FormWordmark", () => {
  it("uses the supplied movement-analysis logo with the FORM name", async () => {
    const screen = await render(<FormWordmark />);

    expect(screen.getByLabelText("FORM logo")).toBeTruthy();
    expect(screen.getByText("FORM")).toBeTruthy();
  });
});
