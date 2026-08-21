import { snappedMuscleMapRotation } from "./muscle-map-rotation";

describe("muscle map rotation", () => {
  it("snaps a deliberate left drag from the front to the back", () => {
    expect(snappedMuscleMapRotation(0, -160, -420, 320)).toBe(-Math.PI);
  });

  it("returns a short slow drag to the current face", () => {
    expect(snappedMuscleMapRotation(0, -24, -40, 320)).toBe(0);
  });

  it("lets a fast flick rotate even before crossing half the body width", () => {
    expect(snappedMuscleMapRotation(Math.PI, 28, 900, 320)).toBe(0);
  });
});
