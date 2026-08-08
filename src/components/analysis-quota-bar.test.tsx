import { render } from "@testing-library/react-native";

import { AnalysisQuotaBar } from "./analysis-quota-bar";

describe("AnalysisQuotaBar", () => {
  it("shows a numeric fraction and proportional gold fill", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={9} limit={10} status="ready" />);
    expect(screen.getByText("9/10")).toBeTruthy();
    expect(screen.getByLabelText("9 of 10 analyses remaining")).toBeTruthy();
    expect(screen.getByTestId("analysis-quota-fill")).toHaveStyle({ width: "90%" });
  });

  it("shows an empty but press-neutral gauge at zero", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={0} limit={10} status="ready" />);
    expect(screen.getByText("0/10")).toBeTruthy();
    expect(screen.getByTestId("analysis-quota-fill")).toHaveStyle({ width: "0%" });
  });

  it("supports checking, expired, and invalid numeric inputs", async () => {
    const checking = await render(<AnalysisQuotaBar remaining={null} limit={0} status="checking" />);
    expect(checking.getByText("—/10")).toBeTruthy();
    expect(checking.getByLabelText("Analysis balance is being checked")).toBeTruthy();

    const expired = await render(<AnalysisQuotaBar remaining={8} limit={10} status="expired" />);
    expect(expired.getByText("0/10")).toBeTruthy();
    expect(expired.getByLabelText("Subscription required. 0 of 10 analyses available")).toBeTruthy();
  });

  it("replaces the exhausted fraction with the purchase call to action", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={0} limit={10} status="purchase" compact />);
    expect(screen.getByText("Purchase a subscription to use the app")).toBeTruthy();
    expect(screen.getByLabelText("Purchase a subscription to use the app")).toBeTruthy();
    expect(screen.queryByText("0/10")).toBeNull();
  });

  it("keeps the compact horizontal track longer than the old pill", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={9} limit={10} status="ready" compact />);
    expect(screen.getByTestId("analysis-quota-bar")).toHaveStyle({ minWidth: 128 });
    expect(screen.getByTestId("analysis-quota-track")).toHaveStyle({ minWidth: 72 });
  });
});
