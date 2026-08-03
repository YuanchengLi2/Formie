import {
  anatomyRotationFromDrag,
  anatomyRotationFromSlider,
  normalizedAnatomyRotation,
} from "./anatomy-rotation";
import { nextAnatomyZoom } from "./anatomy-zoom";

describe("anatomy rotation controls", () => {
  it("maps the full slider width to one complete rotation", () => {
    expect(anatomyRotationFromSlider(0, 240)).toBe(0);
    expect(anatomyRotationFromSlider(120, 240)).toBeCloseTo(Math.PI);
    expect(anatomyRotationFromSlider(240, 240)).toBeCloseTo(Math.PI * 2);
  });

  it("clamps slider positions outside the track", () => {
    expect(anatomyRotationFromSlider(-20, 240)).toBe(0);
    expect(anatomyRotationFromSlider(300, 240)).toBeCloseTo(Math.PI * 2);
  });

  it("uses a faster horizontal-only drag and keeps the slider synchronized", () => {
    const rotation = anatomyRotationFromDrag(Math.PI, 50);
    expect(rotation).toBeCloseTo(Math.PI + 0.9);
    expect(normalizedAnatomyRotation(rotation)).toBeCloseTo((Math.PI + 0.9) / (Math.PI * 2));
  });

  it("zooms out below the initial fitted size while keeping a usable lower bound", () => {
    expect(nextAnatomyZoom(1, 0.8)).toBeCloseTo(0.8);
    expect(nextAnatomyZoom(0.8, 0.8)).toBeCloseTo(0.64);
    expect(nextAnatomyZoom(0.55, 0.8)).toBeCloseTo(0.55);
  });
});
