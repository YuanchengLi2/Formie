import {
  Box3,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
  type ColorRepresentation,
  type Material,
  type Object3D,
} from "three";

import {
  isAnatomyMuscleTag,
  muscleModelHighlightForTag,
  type AnatomyMuscleTag,
  type MuscleModelHighlightKind,
  type MuscleModelSelection,
} from "@/components/muscle-model-regions";

export type AnatomyModelPalette = Record<MuscleModelHighlightKind, ColorRepresentation>;

function muscleTagForObject(object: Object3D): AnatomyMuscleTag | null {
  let current: Object3D | null = object;
  while (current) {
    if (isAnatomyMuscleTag(current.userData.muscle)) return current.userData.muscle;
    current = current.parent;
  }
  return null;
}

export function prepareAnatomyModel(source: Group) {
  const content = source.clone(true);
  content.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(content);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  content.position.sub(center);

  const model = new Group();
  model.add(content);
  if (size.z > size.x && size.z > size.y) model.rotation.x = -Math.PI / 2;
  else if (size.x > size.y) model.rotation.z = Math.PI / 2;
  model.scale.setScalar(3.45 / Math.max(size.x, size.y, size.z));

  content.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const muscle = muscleTagForObject(object);
    object.visible = muscle !== null;
    if (!muscle) return;

    object.geometry = object.geometry.clone();
    if (!object.geometry.getAttribute("normal")) object.geometry.computeVertexNormals();
    object.material = new MeshPhysicalMaterial({
      color: "#FFFFFF",
      metalness: 0,
      roughness: 0.58,
      clearcoat: 0.08,
      clearcoatRoughness: 0.85,
      flatShading: false,
      vertexColors: false,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      side: DoubleSide,
    });
    object.userData.formieMuscle = muscle;
  });
  return model;
}

export function paintAnatomyModel(model: Object3D, selection: MuscleModelSelection, palette: AnatomyModelPalette) {
  const resolvedPalette = Object.fromEntries(
    Object.entries(palette).map(([kind, value]) => [kind, new Color(value)]),
  ) as Record<MuscleModelHighlightKind, Color>;

  model.traverse((object) => {
    if (!(object instanceof Mesh) || !(object.material instanceof MeshPhysicalMaterial)) return;
    const muscle = object.userData.formieMuscle;
    if (!isAnatomyMuscleTag(muscle)) return;
    object.material.color.copy(resolvedPalette[muscleModelHighlightForTag(muscle, selection)]);
  });
}

export function disposeAnatomyModel(model: Object3D) {
  model.traverse((object) => {
    if (!(object instanceof Mesh) || !isAnatomyMuscleTag(object.userData.formieMuscle)) return;
    object.geometry.dispose();
    const materials = (Array.isArray(object.material) ? object.material : [object.material]) as Material[];
    materials.forEach((material) => material.dispose());
  });
}
