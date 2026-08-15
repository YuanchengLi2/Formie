import { createAnalysisFeedbackSubmitter } from "./feedback";

describe("analysis feedback", () => {
  it("submits a session-owned helpful rating through the dedicated RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const submit = createAnalysisFeedbackSubmitter(rpc);

    await submit("session-123", true);

    expect(rpc).toHaveBeenCalledWith("submit_analysis_feedback", { p_session_id: "session-123", p_helpful: true });
  });

  it("surfaces persistence failures instead of pretending the rating was saved", async () => {
    const submit = createAnalysisFeedbackSubmitter(jest.fn().mockResolvedValue({ error: { message: "offline" } }));
    await expect(submit("session-123", false)).rejects.toThrow("offline");
  });
});
