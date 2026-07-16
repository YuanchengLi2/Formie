import { cameraZoomPresets, pinchZoom, resolveCameraZoom, zoomDisplayLabel } from "./camera-zoom";

describe("camera zoom", () => {
  it("always offers 1x and 2x and adds 0.5x when an ultrawide lens exists", () => {
    expect(cameraZoomPresets(["backCamera", "ultraWideCamera"]).map((preset) => preset.label)).toEqual(["0.5x", "1x", "2x"]);
    expect(cameraZoomPresets(["backCamera"]).map((preset) => preset.label)).toEqual(["1x", "2x"]);
  });

  it("uses the ultrawide lens for 0.5x and normalized camera zoom for 2x", () => {
    expect(resolveCameraZoom("0.5x", ["wideAngleCamera", "ultraWideCamera"])).toEqual({ lens: "ultraWideCamera", zoom: 0 });
    expect(resolveCameraZoom("1x", ["wideAngleCamera", "ultraWideCamera"])).toEqual({ lens: "wideAngleCamera", zoom: 0 });
    expect(resolveCameraZoom("2x", ["wideAngleCamera", "ultraWideCamera"])).toEqual({ lens: "wideAngleCamera", zoom: 0.12 });
  });

  it("supports smooth bounded pinch zoom and a readable live label", () => {
    expect(pinchZoom(0.1, 2)).toBeCloseTo(0.22);
    expect(pinchZoom(0.02, 0.1)).toBe(0);
    expect(pinchZoom(0.35, 3)).toBe(0.36);
    expect(zoomDisplayLabel(0)).toBe("1.0x");
    expect(zoomDisplayLabel(0.12)).toBe("2.0x");
  });
});
