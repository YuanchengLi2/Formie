import { normalizeEquipmentLoad } from "./equipment-load";

describe("normalizeEquipmentLoad", () => {
  it("drops an unknown load when the complete observation identifies bodyweight", () => {
    expect(normalizeEquipmentLoad(
      { value: null, unit: null, scope: null, certainty: "unknown", basis: "not_readable" },
      {
        category: "visible_load",
        title: "Bodyweight execution",
        observation: "No external implement is visible.",
      },
    )).toBeNull();
  });

  it("drops load metadata from non-load observation categories", () => {
    expect(normalizeEquipmentLoad(
      { value: 25, unit: "lb", scope: "total", certainty: "exact_visible", basis: "readable_label" },
      { category: "setup", title: "Foot setup", observation: "Feet stay planted." },
    )).toBeNull();
  });

  it("keeps a fully readable exact visible load", () => {
    expect(normalizeEquipmentLoad(
      { value: 25, unit: "lb", scope: "per dumbbell", certainty: "exact_visible", basis: "readable_label" },
      { category: "visible_load", title: "Readable dumbbells", observation: "Each dumbbell label reads 25 lb." },
    )).toEqual({
      value: 25,
      unit: "lb",
      scope: "per dumbbell",
      certainty: "exact_visible",
      basis: "readable_label",
    });
  });
});
