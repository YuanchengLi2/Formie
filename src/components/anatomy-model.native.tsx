import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Asset } from "expo-asset";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { Image } from "expo-image";
import { loadAsync, Renderer } from "expo-three";
import * as THREE from "three";

import { AnatomyInteractionSurface } from "@/components/anatomy-interaction-surface";
import { AnatomyZoneHighlights } from "@/components/anatomy-zone-highlights";
import {
  anatomyHighlightForName,
  fittedAnatomyScale,
  isSurfaceAnatomyMuscle,
  type AnatomyHighlight,
} from "@/components/anatomy-region-mapping";
import { anatomyRotationFromDrag, normalizedAnatomyRotation } from "@/components/anatomy-rotation";
import { AnatomyRotationControl } from "@/components/anatomy-rotation-control";
import { nextAnatomyZoom } from "@/components/anatomy-zoom";
import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";

export type AnatomyModelProps = {
  targetRegions: MuscleRegion[];
  secondaryRegions: MuscleRegion[];
  issueRegions: AnatomyRegion[];
};

type MaterialPalette = Record<AnatomyHighlight, THREE.MeshStandardMaterial>;

// Metro turns this bundled GLB into a native asset module.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL = require("../../assets/models/z-anatomy-muscles-mobile.glb");

const STRUCTURAL_BONE_PATTERN = /(?:frontal bone|parietal bone|occipital bone|temporal bone|zygomatic bone|maxilla|mandible|nasal bone|patella|carpal|metacarpal|phalanx|tarsal|metatarsal|calcaneus|talus)/;

function searchableName(object: THREE.Object3D): string {
  return [
    object.name,
    object.userData.name,
    object.userData.nameDetail,
  ].filter(Boolean).join(" ").toLowerCase();
}

function isMuscle(object: THREE.Object3D): boolean {
  return String(object.userData.type ?? "").toLowerCase() === "muscle";
}

function isStructuralBone(name: string): boolean {
  return STRUCTURAL_BONE_PATTERN.test(name);
}

function makeMaterialPalette(): MaterialPalette {
  return {
    target: new THREE.MeshStandardMaterial({
      color: 0x35d07f,
      emissive: 0x0c4a2a,
      emissiveIntensity: 0.95,
      roughness: 0.62,
      metalness: 0,
    }),
    secondary: new THREE.MeshStandardMaterial({
      color: 0xf05a5a,
      emissive: 0x5b1414,
      emissiveIntensity: 0.95,
      roughness: 0.62,
      metalness: 0,
    }),
    issue: new THREE.MeshStandardMaterial({
      color: 0xf1b542,
      emissive: 0x5b3b0c,
      emissiveIntensity: 0.95,
      roughness: 0.62,
      metalness: 0,
    }),
    rest: new THREE.MeshStandardMaterial({
      color: 0x76524d,
      roughness: 0.82,
      metalness: 0,
    }),
    bone: new THREE.MeshStandardMaterial({
      color: 0x7b7670,
      roughness: 0.88,
      metalness: 0,
    }),
  };
}

function disposeOriginalMaterials(root: THREE.Object3D) {
  const disposed = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;
    const assignedMaterial = (object as THREE.Mesh).material as THREE.Material | THREE.Material[];
    const materials: THREE.Material[] = Array.isArray(assignedMaterial)
      ? assignedMaterial
      : [assignedMaterial];
    materials.forEach((material) => {
      if (!disposed.has(material)) {
        disposed.add(material);
        material.dispose();
      }
    });
  });
}

function applyAnatomyMaterials(
  root: THREE.Object3D,
  palette: MaterialPalette,
  targetRegions: readonly MuscleRegion[],
  secondaryRegions: readonly MuscleRegion[],
  issueRegions: readonly AnatomyRegion[],
) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    const name = searchableName(object);
    const muscle = isMuscle(object);
    const surfaceMuscle = muscle && isSurfaceAnatomyMuscle(name);
    const structuralBone = !muscle && isStructuralBone(name);
    mesh.visible = surfaceMuscle || structuralBone;
    if (!mesh.visible) return;

    const highlight = anatomyHighlightForName(
      name,
      muscle,
      targetRegions,
      secondaryRegions,
      issueRegions,
    );
    mesh.material = palette[highlight];
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
}

export function AnatomyModel({ targetRegions, secondaryRegions, issueRegions }: AnatomyModelProps) {
  const [failed, setFailed] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const mountedRef = useRef(true);
  const modelRef = useRef<THREE.Group | null>(null);
  const rootRef = useRef<THREE.Object3D | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const paletteRef = useRef<MaterialPalette | null>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const fittedScaleRef = useRef(1);
  const zoomRef = useRef(1);
  const pitchRef = useRef(0);
  const targetRegionsRef = useRef(targetRegions);
  const secondaryRegionsRef = useRef(secondaryRegions);
  const issueRegionsRef = useRef(issueRegions);
  const regionKey = `${targetRegions.join(",")}|${secondaryRegions.join(",")}|${issueRegions.join(",")}`;

  useEffect(() => () => {
    mountedRef.current = false;
    rendererRef.current?.dispose();
    Object.values(paletteRef.current ?? {}).forEach((material) => material.dispose());
  }, []);

  useEffect(() => {
    targetRegionsRef.current = targetRegions;
    secondaryRegionsRef.current = secondaryRegions;
    issueRegionsRef.current = issueRegions;
    if (rootRef.current && paletteRef.current) {
      applyAnatomyMaterials(
        rootRef.current,
        paletteRef.current,
        targetRegions,
        secondaryRegions,
        issueRegions,
      );
      renderRef.current?.();
    }
    // The key deliberately tracks the region values rather than array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionKey]);

  const changeRotation = useCallback((nextRotation: number) => {
    setRotation(nextRotation);
    if (modelRef.current) {
      modelRef.current.rotation.set(pitchRef.current, nextRotation, 0);
      renderRef.current?.();
    }
  }, []);

  const rotate = useCallback((deltaX: number, deltaY: number) => {
    pitchRef.current = Math.max(
      -0.32,
      Math.min(0.32, pitchRef.current + deltaY * 0.004),
    );
    setRotation((current) => {
      const next = anatomyRotationFromDrag(current, deltaX);
      if (modelRef.current) {
        modelRef.current.rotation.set(pitchRef.current, next, 0);
        renderRef.current?.();
      }
      return next;
    });
  }, []);

  const applyZoom = useCallback((scale: number) => {
    const nextZoom = nextAnatomyZoom(zoomRef.current, scale);
    zoomRef.current = nextZoom;
    setZoomLevel(nextZoom);
    modelRef.current?.scale.setScalar(
      fittedAnatomyScale(fittedScaleRef.current, nextZoom),
    );
    renderRef.current?.();
  }, []);
  const zoom = useCallback((scale: number) => applyZoom(scale), [applyZoom]);

  const onContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    try {
      const renderer = new Renderer({
        gl: gl as unknown as WebGLRenderingContext,
        antialias: true,
        alpha: true,
      });
      rendererRef.current = renderer;
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x090909, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        29,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.01,
        100,
      );
      camera.position.set(0, 0.02, 3.45);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x241a18, 2.8));
      const key = new THREE.DirectionalLight(0xffffff, 3.4);
      key.position.set(2.4, 3.2, 4.5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x9bc5ff, 1.35);
      rim.position.set(-3, 1.2, -2.5);
      scene.add(rim);

      await Asset.fromModule(MODEL).downloadAsync();
      const loaded = await loadAsync(MODEL);
      if (!mountedRef.current) return;
      const root = (loaded.scene ?? loaded) as THREE.Object3D;
      const palette = makeMaterialPalette();
      disposeOriginalMaterials(root);
      applyAnatomyMaterials(
        root,
        palette,
        targetRegionsRef.current,
        secondaryRegionsRef.current,
        issueRegionsRef.current,
      );

      const bounds = new THREE.Box3().setFromObject(root);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      root.position.set(-center.x, -center.y, -center.z);

      const wrapper = new THREE.Group();
      wrapper.add(root);
      fittedScaleRef.current = 1.82 / Math.max(size.y, 0.001);
      wrapper.scale.setScalar(fittedAnatomyScale(fittedScaleRef.current, zoomRef.current));
      scene.add(wrapper);

      modelRef.current = wrapper;
      rootRef.current = root;
      paletteRef.current = palette;
      renderRef.current = () => {
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      renderRef.current();
    } catch {
      if (mountedRef.current) setFailed(true);
    }
  }, []);

  const backFacing = normalizedAnatomyRotation(rotation) >= 0.25 && normalizedAnatomyRotation(rotation) < 0.75;

  return (
    <View style={{ gap: spacing.sm }}>
      <AnatomyInteractionSurface
        accessibilityHint="Drag to rotate. Pinch to zoom."
        accessibilityLabel="Rotatable anatomy model"
        accessibilityRole="adjustable"
        onRotate={rotate}
        onZoom={zoom}
        testID="anatomy-gesture-surface"
        style={{
          minHeight: 430,
          overflow: "hidden",
          borderRadius: radii.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        {failed ? (
          <View style={{ position: "absolute", inset: 0, transform: [{ scale: zoomLevel }] }}>
            <Image
              accessibilityLabel="Anatomical muscle figure"
              contentFit="fill"
              source={require("../../assets/production/anatomy-body-front-back.png")}
              testID="anatomy-body-image"
              style={{ position: "absolute", inset: 0, left: backFacing ? "-100%" : "0%", width: "200%", height: "100%" }}
            />
            <AnatomyZoneHighlights targetRegions={targetRegions} secondaryRegions={secondaryRegions} issueRegions={issueRegions} face={backFacing ? "back" : "front"} />
          </View>
        ) : (
          <GLView
            onContextCreate={onContextCreate}
            style={{ flex: 1, minHeight: 430 }}
            testID="anatomy-3d-canvas"
          />
        )}
        {targetRegions.map((region) => (
          <View key={`target-${region}`} pointerEvents="none" testID={`anatomy-target-${region}`} />
        ))}
        {secondaryRegions.map((region) => (
          <View key={`secondary-${region}`} pointerEvents="none" testID={`anatomy-secondary-${region}`} />
        ))}
        {issueRegions.map((region) => (
          <View key={`issue-${region}`} pointerEvents="none" testID={`anatomy-issue-${region}`} />
        ))}
      </AnatomyInteractionSurface>
      <AnatomyRotationControl rotation={rotation} onChange={changeRotation} />
    </View>
  );
}
