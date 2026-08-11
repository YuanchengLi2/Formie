import { V49_ANALYST_MODEL, V49_ANALYST_THINKING_LEVEL, V49_MEDIA_RESOLUTION, V49_REQUESTED_FPS, V49_WRITER_THINKING_LEVEL } from "./config";

it("uses movement-agnostic temporal coverage for short exercise sets", () => {
  expect(V49_ANALYST_MODEL).toBe("gemini-3.6-flash");
  expect(V49_ANALYST_THINKING_LEVEL).toBe("high");
  expect(V49_WRITER_THINKING_LEVEL).toBe("high");
  expect(V49_MEDIA_RESOLUTION).toBe("MEDIA_RESOLUTION_HIGH");
  expect(V49_REQUESTED_FPS).toBe(8);
});
