import {
  Box3,
  Color,
  Float32BufferAttribute,
  FrontSide,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type ColorRepresentation,
  type Group,
  type Material,
  type Object3D,
} from "three";

import {
  muscleModelHighlightForPart,
  muscleModelPartAtPosition,
  type MuscleModelHighlightKind,
  type MuscleModelPart,
  type MuscleModelSelection,
} from "@/components/muscle-model-regions";

export type AnatomyModelPalette = Record<MuscleModelHighlightKind, ColorRepresentation>;

type PaintableGeometry = BufferGeometry & { userData: { formieParts?: MuscleModelPart[] } };

export function prepareAnatomyModel(source: Group) {
  const model = source.clone(true);
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const vertex = new Vector3();

  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry = object.geometry.clone();
    object.geometry.computeVertexNormals();
    object.material = new MeshStandardMaterial({
      color: "#FFFFFF",
      metalness: 0.03,
      roughness: 0.72,
      vertexColors: true,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      side: FrontSide,
    });

    const geometry = object.geometry as PaintableGeometry;
    const position = geometry.getAttribute("position");
    const parts: MuscleModelPart[] = [];
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
      parts.push(muscleModelPartAtPosition(
        (vertex.x - center.x) / size.x,
        (vertex.y - center.y) / size.y,
        (vertex.z - center.z) / size.z,
      ));
    }
    geometry.userData.formieParts = parts;
  });
  return model;
}

export function paintAnatomyModel(model: Object3D, selection: MuscleModelSelection, palette: AnatomyModelPalette) {
  const resolvedPalette = Object.fromEntries(
    Object.entries(palette).map(([kind, value]) => [kind, new Color(value)]),
  ) as Record<MuscleModelHighlightKind, Color>;

  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry as PaintableGeometry;
    const position = geometry.getAttribute("position");
    const parts = geometry.userData.formieParts;
    if (!parts || parts.length !== position.count) return;

    let colorAttribute = geometry.getAttribute("color") as Float32BufferAttribute | undefined;
    if (!colorAttribute || colorAttribute.count !== position.count) {
      colorAttribute = new Float32BufferAttribute(new Float32Array(position.count * 3), 3);
      geometry.setAttribute("color", colorAttribute);
    }
    parts.forEach((part, index) => {
      const color = resolvedPalette[muscleModelHighlightForPart(part, selection)];
      colorAttribute.setXYZ(index, color.r, color.g, color.b);
    });
    colorAttribute.needsUpdate = true;
  });
}

export function disposeAnatomyModel(model: Object3D) {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = (Array.isArray(object.material) ? object.material : [object.material]) as Material[];
    materials.forEach((material) => material.dispose());
  });
}
