import { V49_ANALYST_MODEL, V49_ANALYST_THINKING_LEVEL, V49_REQUESTED_FPS } from "./config";

it("uses movement-agnostic temporal coverage for short exercise sets", () => {
  expect(V49_ANALYST_MODEL).toBe("gemini-3.6-flash");
  expect(V49_ANALYST_THINKING_LEVEL).toBe("high");
  expect(V49_REQUESTED_FPS).toBe(4);
});
