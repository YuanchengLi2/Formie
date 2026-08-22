/* eslint-disable @typescript-eslint/no-require-imports */
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Group,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  disposeAnatomyModel,
  paintAnatomyModel,
  prepareAnatomyModel,
  type AnatomyModelPalette,
} from "@/components/anatomy-model-scene";
import { preferredMuscleMapFace } from "@/components/muscle-map-regions";
import type { MuscleModelSelection } from "@/components/muscle-model-regions";
import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { usePhoneLayoutProfile } from "@/theme/responsive";

export type AnatomyModelProps = {
  targetRegions: MuscleRegion[];
  secondaryRegions: MuscleRegion[];
  issueRegions: AnatomyRegion[];
  mode?: "muscles" | "form";
};

const MODEL_ASSET = require("../../assets/models/formie-segmented-muscles.glb") as number;
const MODEL_PALETTE: AnatomyModelPalette = {
  base: colors.textMuted,
  target: colors.gold,
  secondary: colors.goldPressed,
  issue: colors.danger,
};

type RenderResources = {
  renderer: WebGLRenderer;
  model: Group;
  frameId: number;
};

export function AnatomyModel({ targetRegions, secondaryRegions, issueRegions }: AnatomyModelProps) {
  const layout = usePhoneLayoutProfile();
  const surfaceHeight = Math.min(430, Math.max(300, layout.artworkMaxHeight));
  const { width } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const resourcesRef = useRef<RenderResources | null>(null);
  const mountedRef = useRef(true);
  const rotationRef = useRef(0);
  const angularVelocityRef = useRef(0);
  const gestureStartRef = useRef(0);
  const selection = useMemo<MuscleModelSelection>(
    () => ({ targetRegions, secondaryRegions, issueRegions }),
    [issueRegions, secondaryRegions, targetRegions],
  );
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const regionKey = `${targetRegions.join(",")}|${secondaryRegions.join(",")}|${issueRegions.join(",")}`;
  const preferredFace = preferredMuscleMapFace(targetRegions, secondaryRegions, issueRegions);
  const gestureWidth = Math.max(240, Math.min(width - spacing.xl * 2, 420));

  useEffect(() => {
    rotationRef.current = preferredFace === "back" ? Math.PI : 0;
    angularVelocityRef.current = 0;
  }, [preferredFace, regionKey]);

  useEffect(() => {
    const model = resourcesRef.current?.model;
    if (model) paintAnatomyModel(model, selection, MODEL_PALETTE);
  }, [selection]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const resources = resourcesRef.current;
      resourcesRef.current = null;
      if (!resources) return;
      cancelAnimationFrame(resources.frameId);
      disposeAnatomyModel(resources.model);
      resources.renderer.dispose();
    };
  }, []);

  const handleContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    let renderer: WebGLRenderer | null = null;
    let model: Group | null = null;
    try {
      const nativeCanvas = {
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        clientWidth: gl.drawingBufferWidth,
        clientHeight: gl.drawingBufferHeight,
        style: {},
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        setAttribute: () => undefined,
        getContext: () => gl,
      };
      renderer = new WebGLRenderer({
        canvas: nativeCanvas as unknown as HTMLCanvasElement,
        context: gl as unknown as WebGLRenderingContext,
        antialias: true,
        alpha: false,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.92;
      renderer.setClearColor(colors.surface, 1);

      const scene = new Scene();
      scene.add(new HemisphereLight("#FFF2D2", "#20252D", 0.9));
      const keyLight = new DirectionalLight("#FFF7E8", 2.4);
      keyLight.position.set(4, 5, 6);
      scene.add(keyLight);
      const fillLight = new DirectionalLight("#9EB6D8", 0.75);
      fillLight.position.set(-4, 1, 4);
      scene.add(fillLight);
      const rimLight = new DirectionalLight("#F5C879", 1);
      rimLight.position.set(2, 3, -4);
      scene.add(rimLight);

      const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      const viewHeight = width < 350 ? 4.05 : 3.72;
      const camera = new OrthographicCamera(
        -(viewHeight * aspect) / 2,
        (viewHeight * aspect) / 2,
        viewHeight / 2,
        -viewHeight / 2,
        0.1,
        20,
      );
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);

      const asset = Asset.fromModule(MODEL_ASSET);
      await asset.downloadAsync();
      const bytes = await new File(asset.localUri ?? asset.uri).bytes();
      const gltf = await new GLTFLoader().parseAsync(bytes.buffer, "");
      model = prepareAnatomyModel(gltf.scene);
      paintAnatomyModel(model, selectionRef.current, MODEL_PALETTE);
      model.rotation.y = rotationRef.current;
      scene.add(model);

      if (!mountedRef.current) {
        disposeAnatomyModel(model);
        renderer.dispose();
        return;
      }

      const activeRenderer = renderer;
      const activeModel = model;
      const resources: RenderResources = { renderer: activeRenderer, model: activeModel, frameId: 0 };
      resourcesRef.current = resources;
      let previousTime = performance.now();
      const renderFrame = (time: number) => {
        if (!mountedRef.current || resourcesRef.current !== resources) return;
        const deltaSeconds = Math.min((time - previousTime) / 1000, 0.05);
        previousTime = time;
        if (Math.abs(angularVelocityRef.current) > 0.001) {
          rotationRef.current += angularVelocityRef.current * deltaSeconds;
          angularVelocityRef.current *= Math.pow(0.035, deltaSeconds);
        } else {
          angularVelocityRef.current = 0;
        }
        activeModel.rotation.y = rotationRef.current;
        activeRenderer.render(scene, camera);
        gl.endFrameEXP();
        resources.frameId = requestAnimationFrame(renderFrame);
      };
      resources.frameId = requestAnimationFrame(renderFrame);
      setReady(true);
    } catch (error) {
      if (model) disposeAnatomyModel(model);
      renderer?.dispose();
      console.error("Failed to initialize the native anatomy renderer", error);
      if (mountedRef.current) setLoadError(true);
    }
  }, [width]);

  const panGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-10, 10])
    .failOffsetY([-22, 22])
    .onBegin(() => {
      angularVelocityRef.current = 0;
      gestureStartRef.current = rotationRef.current;
    })
    .onUpdate((event) => {
      rotationRef.current = gestureStartRef.current + (event.translationX / gestureWidth) * Math.PI * 1.25;
    })
    .onEnd((event) => {
      angularVelocityRef.current = (event.velocityX / gestureWidth) * Math.PI * 1.25;
    }), [gestureWidth]);

  const rotateByAccessibility = (direction: -1 | 1) => {
    angularVelocityRef.current = 0;
    rotationRef.current += direction * (Math.PI / 2);
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
          style={{ height: surfaceHeight, alignItems: "stretch", justifyContent: "center", overflow: "hidden", borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <View pointerEvents="none" style={{ position: "absolute", alignSelf: "center", width: Math.min(260, layout.artworkMaxWidth * 0.76), height: surfaceHeight * 0.84, opacity: 0.32, borderRadius: 130, backgroundColor: colors.goldSoft, transform: [{ scaleX: 1.2 }] }} />
          <View testID="native-muscle-map" style={{ flex: 1 }}>
            <GLView
              pointerEvents="none"
              testID="anatomy-3d-canvas"
              msaaSamples={4}
              onContextCreate={(gl) => void handleContextCreate(gl)}
              style={{ flex: 1 }}
            />
          </View>
          {!ready && !loadError ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.textMuted, fontSize: 13 }}>Loading 3D muscle model…</Text></View> : null}
          {loadError ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", padding: spacing.xl }}><Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>The 3D muscle model could not load.</Text></View> : null}
          {targetRegions.map((region) => <View key={`target-${region}`} pointerEvents="none" testID={`anatomy-target-${region}`} />)}
          {secondaryRegions.map((region) => <View key={`secondary-${region}`} pointerEvents="none" testID={`anatomy-secondary-${region}`} />)}
          {issueRegions.map((region) => <View key={`issue-${region}`} pointerEvents="none" testID={`anatomy-issue-${region}`} />)}
        </View>
      </GestureDetector>
    </View>
  );
}
