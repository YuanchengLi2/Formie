import { render } from "@testing-library/react-native";

import { AnalysisQuotaBar } from "./analysis-quota-bar";

describe("AnalysisQuotaBar", () => {
  it("shows a numeric fraction and proportional gold fill in meter mode", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={9} limit={10} status="ready" variant="meter" />);
    expect(screen.getByText("9/10")).toBeTruthy();
    expect(screen.getByLabelText("9 of 10 analyses remaining")).toBeTruthy();
    expect(screen.getByTestId("analysis-quota-fill")).toHaveStyle({ width: "90%" });
  });

  it("shows an empty but press-neutral gauge at zero", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={0} limit={10} status="ready" variant="meter" />);
    expect(screen.getByText("0/10")).toBeTruthy();
    expect(screen.getByTestId("analysis-quota-fill")).toHaveStyle({ width: "0%" });
  });

  it("supports checking and expired numeric inputs without subscription copy", async () => {
    const checking = await render(<AnalysisQuotaBar remaining={null} limit={0} status="checking" variant="meter" />);
    expect(checking.getByText("—/10")).toBeTruthy();
    expect(checking.getByLabelText("Analysis balance is being checked")).toBeTruthy();

    const expired = await render(<AnalysisQuotaBar remaining={8} limit={10} status="expired" variant="meter" />);
    expect(expired.getByText("0/10")).toBeTruthy();
    expect(expired.getByLabelText("0 of 10 analyses available")).toBeTruthy();
    expect(expired.queryByText("Subscription required")).toBeNull();
  });

  it("keeps purchase state numeric for the compact header badge", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={0} limit={10} status="purchase" variant="badge" />);
    expect(screen.getByText("0/10")).toBeTruthy();
    expect(screen.getByLabelText("0 of 10 analyses available")).toBeTruthy();
    expect(screen.queryByText("Purchase a subscription to use the app")).toBeNull();
  });

  it("renders a bounded numeric badge without a stretching track", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={9} limit={10} status="ready" variant="badge" />);
    expect(screen.getByTestId("analysis-quota-bar")).toHaveStyle({ width: 64, flexShrink: 0 });
    expect(screen.queryByTestId("analysis-quota-track")).toBeNull();
  });

  it("renders the full meter responsively when requested", async () => {
    const screen = await render(<AnalysisQuotaBar remaining={9} limit={10} status="ready" variant="meter" />);
    expect(screen.getByTestId("analysis-quota-bar")).toHaveStyle({ width: "100%" });
    expect(screen.getByTestId("analysis-quota-track")).toBeTruthy();
  });
});
