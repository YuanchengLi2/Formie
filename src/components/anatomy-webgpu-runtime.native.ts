import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { RNCanvasContext } from "react-native-webgpu";

import { disposeAnatomyModel, paintAnatomyModel, prepareAnatomyModel, type AnatomyModelPalette } from "@/components/anatomy-model-scene";
import type { MuscleModelSelection } from "@/components/muscle-model-regions";
import { colors } from "@/theme/colors";

// Metro resolves the bundled GLB to an Expo asset module on native.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_ASSET = require("../../assets/models/formie-segmented-muscles.glb");
const PALETTE: AnatomyModelPalette = { base: colors.surfaceRaised, target: colors.gold, secondary: colors.goldPressed, issue: colors.danger };

export type AnatomyRendererController = {
  setSelection(selection: MuscleModelSelection): void;
  setRotation(radians: number): void;
  render(): void;
  dispose(): void;
};

type CreateAnatomyRendererInput = { context: RNCanvasContext; selection: MuscleModelSelection; rotation: number };

async function loadModel() {
  const asset = Asset.fromModule(MODEL_ASSET);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error("The segmented anatomy asset is unavailable.");
  const bytes = await new File(asset.localUri).bytes();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  return prepareAnatomyModel(gltf.scene);
}

export async function createAnatomyRenderer({ context, selection, rotation }: CreateAnatomyRendererInput): Promise<AnatomyRendererController> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.surface);
  const aspect = Math.max(0.5, context.canvas.width / Math.max(1, context.canvas.height));
  const camera = new THREE.OrthographicCamera(-2.2 * aspect, 2.2 * aspect, 2.2, -2.2, 0.1, 100);
  camera.position.set(0, 0.05, 6.2);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x19130b, 2.45));
  const key = new THREE.DirectionalLight(0xfff1d3, 4.2);
  key.position.set(3.2, 4.5, 5.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8ca7ff, 2.1);
  fill.position.set(-4, 1.4, 3.2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc66e, 2.7);
  rim.position.set(1.5, 2.5, -4.8);
  scene.add(rim);

  const renderer = new THREE.WebGPURenderer({ antialias: true, canvas: context.canvas, context });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  await renderer.init();
  let model: THREE.Group | null = null;
  let disposed = false;
  try {
    model = await loadModel();
    model.rotation.y = rotation;
    paintAnatomyModel(model, selection, PALETTE);
    scene.add(model);
  } catch (error) {
    renderer.dispose();
    throw error;
  }

  return {
    setSelection(nextSelection) { if (!disposed && model) paintAnatomyModel(model, nextSelection, PALETTE); },
    setRotation(radians) { if (!disposed && model) model.rotation.y = radians; },
    render() {
      if (disposed) return;
      renderer.render(scene, camera);
      context.present();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      if (model) {
        scene.remove(model);
        disposeAnatomyModel(model);
        model = null;
      }
      renderer.dispose();
    },
  };
}
