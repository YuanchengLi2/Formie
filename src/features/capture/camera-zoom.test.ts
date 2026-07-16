import { cameraZoomPresets, resolveCameraZoom } from "./camera-zoom";

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
});
