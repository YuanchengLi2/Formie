import { isV49PrimaryRolloutEnabled } from "./v49-primary-rollout";

describe("v49 primary rollout switch", () => {
  it.each([undefined, "", "false", "TRUE", "1", "enabled"])("fails closed for %p", (value) => {
    expect(isV49PrimaryRolloutEnabled(value)).toBe(false);
  });

  it("enables primary routing only for the exact release value", () => {
    expect(isV49PrimaryRolloutEnabled("true")).toBe(true);
  });
});
