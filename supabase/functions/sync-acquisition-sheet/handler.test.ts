import { handleAcquisitionSheetSync, type AcquisitionSheetRow } from "./handler";

const row: AcquisitionSheetRow = {
  id: "response-1",
  created_at: "2026-08-06T12:00:00.000Z",
  user_id: "user-1",
  source: "instagram",
  other_detail: null,
  platform: "ios",
  onboarding_version: "approved-v1",
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    authenticate: jest.fn().mockResolvedValue(undefined),
    claimRows: jest.fn().mockResolvedValue([row]),
    existingResponseIds: jest.fn().mockResolvedValue(new Set<string>()),
    appendRows: jest.fn().mockResolvedValue(undefined),
    markSynced: jest.fn().mockResolvedValue(undefined),
    releaseRows: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("acquisition sheet sync handler", () => {
  it("keeps durable rows queued when Sheets is not configured", async () => {
    const deps = dependencies();
    const response = await handleAcquisitionSheetSync(new Request("https://example.test"), deps, { configured: false });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "queued", reason: "sheet_not_configured" });
    expect(deps.authenticate).toHaveBeenCalled();
    expect(deps.claimRows).not.toHaveBeenCalled();
  });

  it("deduplicates by response id and exports only the minimal reporting columns", async () => {
    const second = { ...row, id: "response-2", user_id: "user-2", source: "other", other_detail: "Podcast" };
    const deps = dependencies({
      claimRows: jest.fn().mockResolvedValue([row, second]),
      existingResponseIds: jest.fn().mockResolvedValue(new Set(["response-1"])),
    });
    const response = await handleAcquisitionSheetSync(new Request("https://example.test"), deps, { configured: true });
    expect(response.status).toBe(200);
    expect(deps.appendRows).toHaveBeenCalledWith([["response-2", second.created_at, "user-2", "other", "Podcast", "ios", "approved-v1"]]);
    expect(deps.markSynced).toHaveBeenCalledWith(["response-1", "response-2"]);
  });

  it("releases claimed rows for retry after a substantive provider failure", async () => {
    const deps = dependencies({ appendRows: jest.fn().mockRejectedValue(new Error("Google unavailable")) });
    const response = await handleAcquisitionSheetSync(new Request("https://example.test"), deps, { configured: true });
    expect(response.status).toBe(502);
    expect(deps.releaseRows).toHaveBeenCalledWith(["response-1"], "Google unavailable");
  });
});
