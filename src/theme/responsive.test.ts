import { getPhoneLayoutProfile } from "./responsive";

describe("getPhoneLayoutProfile", () => {
  it.each([
    {
      name: "compact short phone",
      input: { width: 320, height: 568, fontScale: 1, insets: { top: 20, right: 0, bottom: 0, left: 0 } },
      expected: { size: "compact", compact: true, large: false, short: true, horizontalPadding: 12, contentWidth: 296, stackControls: true, bottomPadding: 24 },
    },
    {
      name: "regular notched phone",
      input: { width: 390, height: 844, fontScale: 1, insets: { top: 47, right: 0, bottom: 34, left: 0 } },
      expected: { size: "regular", compact: false, large: false, short: false, horizontalPadding: 16, contentWidth: 358, stackControls: false, bottomPadding: 50 },
    },
    {
      name: "large phone with large text",
      input: { width: 480, height: 1040, fontScale: 1.6, insets: { top: 54, right: 0, bottom: 34, left: 0 } },
      expected: { size: "large", compact: false, large: true, short: false, horizontalPadding: 24, contentWidth: 432, stackControls: true, bottomPadding: 50 },
    },
  ])("derives the $name without hiding safe-area space", ({ input, expected }) => {
    expect(getPhoneLayoutProfile(input)).toMatchObject(expected);
  });

  it("treats a tall device as short when safe areas leave no vertical room", () => {
    const profile = getPhoneLayoutProfile({
      width: 430,
      height: 760,
      fontScale: 1,
      insets: { top: 54, right: 0, bottom: 34, left: 0 },
    });

    expect(profile.availableHeight).toBe(672);
    expect(profile.short).toBe(true);
    expect(profile.artworkMaxHeight).toBe(282);
  });
});
