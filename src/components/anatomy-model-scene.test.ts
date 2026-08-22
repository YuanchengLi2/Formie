import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
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
  it("creates an opaque clone and paints its classified vertices", () => {
    const source = sourceModel();
    const model = prepareAnatomyModel(source);
    const mesh = model.children[0] as Mesh;

    expect(mesh).not.toBe(source.children[0]);
    expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
    expect((mesh.material as MeshStandardMaterial).transparent).toBe(false);
    expect((mesh.material as MeshStandardMaterial).depthWrite).toBe(true);

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

    const color = mesh.geometry.getAttribute("color");
    expect(Array.from(color.array)).toEqual([
      0.005181516520678997, 0.005181516520678997, 0.005181516520678997,
      0.005181516520678997, 0.005181516520678997, 0.005181516520678997,
      1, 0.6038273572921753, 0,
    ]);
  });

  it("disposes cloned geometry and materials", () => {
    const model = prepareAnatomyModel(sourceModel());
    const mesh = model.children[0] as Mesh;
    let geometryDisposals = 0;
    let materialDisposals = 0;
    mesh.geometry.addEventListener("dispose", () => geometryDisposals += 1);
    (mesh.material as MeshStandardMaterial).addEventListener("dispose", () => materialDisposals += 1);

    disposeAnatomyModel(model);

    expect(geometryDisposals).toBe(1);
    expect(materialDisposals).toBe(1);
  });
});
