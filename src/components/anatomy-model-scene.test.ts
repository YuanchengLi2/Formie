import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
} from "three";

import {
  disposeAnatomyModel,
  paintAnatomyModel,
  prepareAnatomyModel,
} from "./anatomy-model-scene";

function sourceModel() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -1, -1, -1,
    1, 1, 1,
    0, 0, 0,
  ], 3));
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  const group = new Group();
  group.add(mesh);
  return group;
}

describe("native anatomy model scene", () => {
  it("creates an opaque clone and paints its complete tagged mesh", () => {
    const source = sourceModel();
    source.userData.muscle = "abs";
    const model = prepareAnatomyModel(source);
    const mesh = model.getObjectByProperty("type", "Mesh") as Mesh;

    expect(mesh).not.toBe(source.children[0]);
    expect(mesh.material).toBeInstanceOf(MeshPhysicalMaterial);
    expect((mesh.material as MeshPhysicalMaterial).transparent).toBe(false);
    expect((mesh.material as MeshPhysicalMaterial).depthWrite).toBe(true);

    paintAnatomyModel(model, {
      targetRegions: ["abs"],
      secondaryRegions: [],
      issueRegions: [],
    }, {
      base: "#101010",
      target: "#ffcc00",
      secondary: "#cc9900",
      issue: "#ff3300",
    });

    expect((mesh.material as MeshPhysicalMaterial).color.getHexString()).toBe("ffcc00");
    expect(mesh.geometry.getAttribute("color")).toBeUndefined();
  });

  it("uses a softly reflective physical surface so body contours remain visible", () => {
    const source = sourceModel();
    source.userData.muscle = "abs";
    const model = prepareAnatomyModel(source);
    const material = (model.getObjectByProperty("type", "Mesh") as Mesh).material as MeshPhysicalMaterial;

    expect(material).toBeInstanceOf(MeshPhysicalMaterial);
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBeGreaterThanOrEqual(0.45);
    expect(material.roughness).toBeLessThanOrEqual(0.7);
    expect(material.clearcoat).toBeGreaterThan(0);
    expect(material.clearcoat).toBeLessThanOrEqual(0.15);
    expect(material.flatShading).toBe(false);
  });

  it("colors a complete tagged muscle mesh instead of painting coordinate bands", () => {
    const source = sourceModel();
    source.userData.muscle = "deltoids";
    const model = prepareAnatomyModel(source);
    const mesh = model.getObjectByProperty("type", "Mesh") as Mesh;

    paintAnatomyModel(model, {
      targetRegions: ["front_shoulders"],
      secondaryRegions: [],
      issueRegions: [],
    }, {
      base: "#101010",
      target: "#ffcc00",
      secondary: "#cc9900",
      issue: "#ff3300",
    });

    expect((mesh.material as MeshPhysicalMaterial).color.getHexString()).toBe("ffcc00");
    expect(mesh.geometry.getAttribute("color")).toBeUndefined();
  });

  it("disposes cloned geometry and materials", () => {
    const source = sourceModel();
    source.userData.muscle = "abs";
    const model = prepareAnatomyModel(source);
    const mesh = model.getObjectByProperty("type", "Mesh") as Mesh;
    let geometryDisposals = 0;
    let materialDisposals = 0;
    mesh.geometry.addEventListener("dispose", () => geometryDisposals += 1);
    (mesh.material as MeshPhysicalMaterial).addEventListener("dispose", () => materialDisposals += 1);

    disposeAnatomyModel(model);

    expect(geometryDisposals).toBe(1);
    expect(materialDisposals).toBe(1);
  });
});
