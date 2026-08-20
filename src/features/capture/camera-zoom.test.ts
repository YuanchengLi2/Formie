import { cameraLensDetent, cameraZoomPresets, lensForMagnification, mergeCameraLensInventory, pinchMagnification, pinchZoom, resolveCameraMagnification, resolveCameraZoom, zoomDisplayLabel } from "./camera-zoom";

describe("camera zoom", () => {
  it("always offers 1x and 2x and adds 0.5x when an ultrawide lens exists", () => {
    expect(cameraZoomPresets(["backCamera", "ultraWideCamera"]).map((preset) => preset.label)).toEqual(["0.5x", "1x", "2x"]);
    expect(cameraZoomPresets(["Back Camera", "Ultra Wide Camera"]).map((preset) => preset.label)).toEqual(["0.5x", "1x", "2x"]);
    expect(cameraZoomPresets(["backCamera"]).map((preset) => preset.label)).toEqual(["1x", "2x"]);
  });

  it("merges asynchronous lens snapshots without losing a discovered physical lens", () => {
    expect(mergeCameraLensInventory(
      ["wideAngleCamera", "ultraWideCamera"],
      ["wideAngleCamera"],
    )).toEqual(["wideAngleCamera", "ultraWideCamera"]);
  });

  it("uses the ultrawide lens for 0.5x and normalized camera zoom for 2x", () => {
    expect(resolveCameraZoom("0.5x", ["wideAngleCamera", "ultraWideCamera"])).toEqual({ lens: "ultraWideCamera", zoom: 0 });
    expect(resolveCameraZoom("0.5x", ["Wide Angle Camera", "Ultra Wide Camera"])).toEqual({ lens: "Ultra Wide Camera", zoom: 0 });
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

  it("uses one continuous iPhone-style magnification for presets and pinch", () => {
    const lenses = ["wideAngleCamera", "ultraWideCamera"];

    expect(resolveCameraMagnification(0.5, lenses)).toEqual({ lens: "ultraWideCamera", magnification: 0.5, zoom: 0 });
    expect(resolveCameraMagnification(1, lenses)).toEqual({ lens: "wideAngleCamera", magnification: 1, zoom: 0 });
    expect(resolveCameraMagnification(2, lenses)).toEqual({ lens: "wideAngleCamera", magnification: 2, zoom: 0.12 });
    expect(pinchMagnification(1, 0.5, true)).toBe(0.5);
    expect(pinchMagnification(0.5, 4, true)).toBe(2);
    expect(pinchMagnification(1, 0.25, false)).toBe(1);
    expect(pinchMagnification(2, 3, true)).toBe(4);
  });

  it("keeps a physical lens selected through the 1x boundary with hysteresis", () => {
    const lenses = ["wideAngleCamera", "ultraWideCamera"];
    expect(lensForMagnification(0.95, lenses, "wideAngleCamera")).toBe("wideAngleCamera");
    expect(lensForMagnification(0.93, lenses, "wideAngleCamera")).toBe("ultraWideCamera");
    expect(lensForMagnification(1.04, lenses, "ultraWideCamera")).toBe("ultraWideCamera");
    expect(lensForMagnification(1.07, lenses, "ultraWideCamera")).toBe("wideAngleCamera");
    expect(resolveCameraMagnification(0.95, lenses, "wideAngleCamera").zoom).toBe(0);
  });

  it("only exposes physical detents for haptic and selected-label transitions", () => {
    expect(cameraLensDetent(0.5, true)).toBe("0.5x");
    expect(cameraLensDetent(0.99, true)).toBe("1x");
    expect(cameraLensDetent(1.76, true)).toBe("2x");
    expect(cameraLensDetent(0.5, false)).toBe("1x");
  });
});
