import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { AnalysisQuotaBar } from "./analysis-quota-bar";

describe("AnalysisQuotaBar", () => {
  it("shows the fraction on the left and a proportional long fill bar", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={9} limit={10} status="ready" />);
    expect(screen.getByText("9/10")).toBeTruthy();
    expect(screen.getByText("9/10")).toHaveStyle({ fontSize: 14 });
    expect(screen.getByLabelText("9 of 10 analyses remaining")).toBeTruthy();
    expect(screen.getByTestId("analysis-quota-track")).toBeTruthy();
    expect(screen.getByTestId("analysis-quota-fill")).toHaveStyle({ width: "90%" });
  });

  it("shows an empty but press-neutral gauge at zero", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={0} limit={10} status="ready" />);
    expect(screen.getByText("0/10")).toBeTruthy();
    expect(screen.getByTestId("analysis-quota-fill")).toHaveStyle({ width: "0%" });
  });

  it("supports checking and expired numeric inputs without subscription copy", async () => {
    const checking = await render(<AnalysisQuotaBar remaining={null} limit={0} status="checking" />);
    expect(checking.getByText("—/10")).toBeTruthy();
    expect(checking.getByLabelText("Analysis balance is being checked")).toBeTruthy();

    const expired = await render(<AnalysisQuotaBar remaining={8} limit={10} status="expired" />);
    expect(expired.getByText("0/10")).toBeTruthy();
    expect(expired.getByLabelText("0 of 10 analyses available")).toBeTruthy();
    expect(expired.queryByText("Subscription required")).toBeNull();
  });

  it("keeps purchase state on the long empty meter", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={0} limit={10} status="purchase" />);
    expect(screen.getByText("0/10")).toBeTruthy();
    expect(screen.getByLabelText("0 of 10 analyses available")).toBeTruthy();
    expect(screen.getByTestId("analysis-quota-track")).toBeTruthy();
    expect(screen.queryByText("Purchase a subscription to use the app")).toBeNull();
  });

  it("renders the full meter responsively", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={9} limit={10} status="ready" />);
    const barStyle = StyleSheet.flatten(screen.getByTestId("analysis-quota-bar").props.style);
    expect(barStyle).toMatchObject({ width: "100%" });
    expect(barStyle).not.toHaveProperty("borderWidth");
    expect(barStyle).not.toHaveProperty("borderColor");
    expect(screen.getByTestId("analysis-quota-track")).toBeTruthy();
  });
});
