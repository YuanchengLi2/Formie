/* eslint-disable @typescript-eslint/no-require-imports, react/no-unknown-property */
import { Canvas, useFrame, useLoader } from "@react-three/fiber/native";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { cancelAnimation, ReduceMotion, useSharedValue, withDecay, withSpring, type SharedValue } from "react-native-reanimated";
import {
  Box3,
  Color,
  Float32BufferAttribute,
  FrontSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { preferredMuscleMapFace } from "@/components/muscle-map-regions";
import {
  muscleModelHighlightForPart,
  muscleModelPartAtPosition,
  type MuscleModelHighlightKind,
  type MuscleModelPart,
  type MuscleModelSelection,
} from "@/components/muscle-model-regions";
import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";

export type AnatomyModelProps = {
  targetRegions: MuscleRegion[];
  secondaryRegions: MuscleRegion[];
  issueRegions: AnatomyRegion[];
  mode?: "muscles" | "form";
};

const MODEL_ASSET = require("../../assets/models/formie-athlete-body.glb") as number;
const MODEL_COLORS: Record<MuscleModelHighlightKind, Color> = {
  base: new Color(colors.textMuted),
  target: new Color(colors.gold),
  secondary: new Color(colors.goldPressed),
  issue: new Color(colors.danger),
};

const SPRING = {
  duration: 400,
  dampingRatio: 0.82,
  reduceMotion: ReduceMotion.System,
} as const;

type PaintableGeometry = BufferGeometry & { userData: { formieParts?: MuscleModelPart[] } };

function paintModel(model: Object3D, selection: MuscleModelSelection) {
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
      const color = MODEL_COLORS[muscleModelHighlightForPart(part, selection)];
      colorAttribute.setXYZ(index, color.r, color.g, color.b);
    });
    colorAttribute.needsUpdate = true;
  });
}

function prepareModel(source: Group) {
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
    object.castShadow = false;
    object.receiveShadow = false;

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

function AthleteMesh({ rotation, selection, onReady }: { rotation: SharedValue<number>; selection: MuscleModelSelection; onReady: () => void }) {
  // R3F's native loader accepts the numeric Metro asset module at runtime.
  const gltf = useLoader(GLTFLoader, MODEL_ASSET as unknown as string) as GLTF;
  const model = useMemo(() => prepareModel(gltf.scene), [gltf.scene]);
  const group = useRef<Group>(null);

  useLayoutEffect(() => paintModel(model, selection), [model, selection]);
  useEffect(() => onReady(), [onReady]);
  useFrame(() => {
    if (group.current) group.current.rotation.y = rotation.get();
  });

  return <group ref={group}><primitive object={model} /></group>;
}

export function AnatomyModel({ targetRegions, secondaryRegions, issueRegions }: AnatomyModelProps) {
  const { width } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const handleModelReady = useCallback(() => setReady(true), []);
  const selection = useMemo(() => ({ targetRegions, secondaryRegions, issueRegions }), [issueRegions, secondaryRegions, targetRegions]);
  const regionKey = `${targetRegions.join(",")}|${secondaryRegions.join(",")}|${issueRegions.join(",")}`;
  const preferredFace = preferredMuscleMapFace(targetRegions, secondaryRegions, issueRegions);
  const rotation = useSharedValue(preferredFace === "back" ? Math.PI : 0);
  const gestureStart = useSharedValue(rotation.value);
  const gestureWidth = Math.max(240, Math.min(width - spacing.xl * 2, 420));

  useEffect(() => {
    rotation.value = withSpring(preferredFace === "back" ? Math.PI : 0, SPRING);
    // The region key resets orientation only when the highlighted anatomy changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredFace, regionKey]);

  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-22, 22])
    .onBegin(() => {
      cancelAnimation(rotation);
      gestureStart.value = rotation.value;
    })
    .onUpdate((event) => {
      rotation.value = gestureStart.value + (event.translationX / gestureWidth) * Math.PI * 1.25;
    })
    .onEnd((event) => {
      rotation.value = withDecay({
        velocity: (event.velocityX / gestureWidth) * Math.PI * 1.25,
        deceleration: 0.995,
        reduceMotion: ReduceMotion.System,
      });
    }), [gestureStart, gestureWidth, rotation]);

  const rotateByAccessibility = (direction: -1 | 1) => {
    rotation.value = withSpring(rotation.value + direction * (Math.PI / 2), SPRING);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <GestureDetector gesture={panGesture}>
        <View
          accessibilityActions={[{ name: "increment", label: "Rotate right" }, { name: "decrement", label: "Rotate left" }]}
          accessibilityHint="Swipe horizontally to rotate the solid 3D body. Vertical swipes continue scrolling the page."
          accessibilityLabel="Rotatable 3D muscle model"
          accessibilityRole="adjustable"
          onAccessibilityAction={({ nativeEvent }) => rotateByAccessibility(nativeEvent.actionName === "decrement" ? -1 : 1)}
          testID="anatomy-gesture-surface"
          style={{ height: 430, alignItems: "stretch", justifyContent: "center", overflow: "hidden", borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <View pointerEvents="none" style={{ position: "absolute", alignSelf: "center", width: 260, height: 360, opacity: 0.32, borderRadius: 130, backgroundColor: colors.goldSoft, transform: [{ scaleX: 1.2 }] }} />
          <View testID="native-muscle-map" style={{ flex: 1 }}>
            <Canvas
              testID="anatomy-3d-canvas"
              orthographic
              camera={{ position: [0, 0, 5], zoom: width < 350 ? 92 : 103, near: 0.1, far: 20 }}
              gl={{ antialias: true, alpha: false }}
              onCreated={({ gl }) => gl.setClearColor(colors.surface, 1)}
            >
              <hemisphereLight args={["#FFF4DD", "#17130F", 1.7]} />
              <directionalLight color="#FFF5E0" intensity={2.2} position={[3, 4, 5]} />
              <directionalLight color={colors.gold} intensity={1.1} position={[-4, 1, 2]} />
              <directionalLight color="#6E7B91" intensity={0.7} position={[1, 1, -5]} />
              <Suspense fallback={null}>
                <AthleteMesh rotation={rotation} selection={selection} onReady={handleModelReady} />
              </Suspense>
            </Canvas>
          </View>
          {!ready ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.textMuted, fontSize: 13 }}>Loading 3D muscle model…</Text></View> : null}
          {targetRegions.map((region) => <View key={`target-${region}`} pointerEvents="none" testID={`anatomy-target-${region}`} />)}
          {secondaryRegions.map((region) => <View key={`secondary-${region}`} pointerEvents="none" testID={`anatomy-secondary-${region}`} />)}
          {issueRegions.map((region) => <View key={`issue-${region}`} pointerEvents="none" testID={`anatomy-issue-${region}`} />)}
        </View>
      </GestureDetector>
    </View>
  );
}
