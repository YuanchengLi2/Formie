import { anatomyBodyZonesForRegion } from "./anatomy-body-zones";

describe("anatomyBodyZonesForRegion", () => {
  it("places pectoral highlights only over the front chest", () => {
    const zones = anatomyBodyZonesForRegion("chest");

    expect(zones.map((zone) => zone.id)).toEqual(["front-left-pec", "front-right-pec"]);
    expect(zones.every((zone) => zone.face === "front")).toBe(true);
    expect(zones.map((zone) => zone.x + zone.width / 2)).toEqual([
      expect.closeTo(0.5, 2),
      expect.closeTo(0.63, 2),
    ]);
  });

  it("places lat highlights on both sides of the back", () => {
    const zones = anatomyBodyZonesForRegion("lats");

    expect(zones.map((zone) => zone.id)).toEqual(["back-left-lat", "back-right-lat"]);
    expect(zones.every((zone) => zone.face === "back")).toBe(true);
    expect(zones.map((zone) => zone.x + zone.width / 2)).toEqual([
      expect.closeTo(0.335, 2),
      expect.closeTo(0.525, 2),
    ]);
  });

  it("maps a knee issue to both knee joints instead of a tiny unrelated muscle", () => {
    const zones = anatomyBodyZonesForRegion("knees");

    expect(zones).toHaveLength(4);
    expect(new Set(zones.map((zone) => zone.face))).toEqual(new Set(["front", "back"]));
    expect(zones.every((zone) =>
      zone.x >= 0 && zone.x <= 1
      && zone.y >= 0 && zone.y <= 1
      && zone.width > 0 && zone.height > 0
    )).toBe(true);
  });
});
