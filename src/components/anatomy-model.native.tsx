import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Canvas, type CanvasRef } from "react-native-webgpu";

import { createAnatomyRenderer, type AnatomyRendererController } from "./anatomy-webgpu-runtime.native";
import { FormButton } from "@/components/form-button";
import { preferredMuscleMapFace } from "@/components/muscle-map-regions";
import type { MuscleModelSelection } from "@/components/muscle-model-regions";
import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export type AnatomyModelProps = {
  targetRegions: MuscleRegion[];
  secondaryRegions: MuscleRegion[];
  issueRegions: AnatomyRegion[];
  mode?: "muscles" | "form";
};

export function AnatomyModel({ targetRegions, secondaryRegions, issueRegions }: AnatomyModelProps) {
  const { width } = useWindowDimensions();
  const canvasRef = useRef<CanvasRef>(null);
  const controllerRef = useRef<AnatomyRendererController | null>(null);
  const rotationRef = useRef(0);
  const gestureStartRef = useRef(0);
  const velocityRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const gestureWidth = Math.max(240, Math.min(width - spacing.xl * 2, 420));
  const selection = useMemo<MuscleModelSelection>(() => ({ targetRegions, secondaryRegions, issueRegions }), [issueRegions, secondaryRegions, targetRegions]);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const preferredRotation = preferredMuscleMapFace(targetRegions, secondaryRegions, issueRegions) === "back" ? Math.PI : 0;
  const selectionKey = `${targetRegions.join(",")}|${secondaryRegions.join(",")}|${issueRegions.join(",")}`;

  const draw = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (Math.abs(velocityRef.current) > 0.0002) {
      rotationRef.current += velocityRef.current;
      velocityRef.current *= 0.94;
      controller.setRotation(rotationRef.current);
    }
    controller.render();
    animationFrameRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    rotationRef.current = preferredRotation;
    velocityRef.current = 0;
    controllerRef.current?.setRotation(preferredRotation);
    controllerRef.current?.render();
    // Reset the starting face only when highlighted anatomy changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  useEffect(() => {
    controllerRef.current?.setSelection(selection);
    controllerRef.current?.render();
  }, [selection]);

  useEffect(() => {
    let active = true;
    setReady(false);
    setLoadError(false);
    const context = canvasRef.current?.getContext("webgpu");
    if (!context) {
      setLoadError(true);
      return undefined;
    }
    void createAnatomyRenderer({ context, selection: selectionRef.current, rotation: rotationRef.current }).then((controller) => {
      if (!active) {
        controller.dispose();
        return;
      }
      controllerRef.current = controller;
      setReady(true);
      animationFrameRef.current = requestAnimationFrame(draw);
    }).catch(() => {
      if (active) setLoadError(true);
    });
    return () => {
      active = false;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [draw, retryGeneration]);

  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-22, 22])
    .runOnJS(true)
    .onBegin(() => {
      velocityRef.current = 0;
      gestureStartRef.current = rotationRef.current;
    })
    .onUpdate((event) => {
      rotationRef.current = gestureStartRef.current + (event.translationX / gestureWidth) * Math.PI * 2;
      controllerRef.current?.setRotation(rotationRef.current);
      controllerRef.current?.render();
    })
    .onEnd((event) => {
      velocityRef.current = Math.max(-0.22, Math.min(0.22, event.velocityX / gestureWidth / 22));
    }), [gestureWidth]);

  const rotateByAccessibility = (direction: -1 | 1) => {
    rotationRef.current += direction * Math.PI / 4;
    velocityRef.current = 0;
    controllerRef.current?.setRotation(rotationRef.current);
    controllerRef.current?.render();
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <GestureDetector gesture={panGesture}>
        <View
          accessibilityActions={[{ name: "increment", label: "Rotate right" }, { name: "decrement", label: "Rotate left" }]}
          accessibilityHint="Swipe horizontally to rotate the three-dimensional body."
          accessibilityLabel="Rotatable 3D muscle model"
          accessibilityRole="adjustable"
          onAccessibilityAction={({ nativeEvent }) => rotateByAccessibility(nativeEvent.actionName === "decrement" ? -1 : 1)}
          testID="anatomy-gesture-surface"
          style={{ height: 430, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <Canvas ref={canvasRef} testID="anatomy-3d-canvas" style={{ position: "absolute", inset: 0 }} />
          {!ready && !loadError ? <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Loading 3D muscle model…</Text> : null}
          {loadError ? (
            <View style={{ width: "82%", gap: spacing.md, alignItems: "stretch" }}>
              <Text selectable style={[typography.body, { color: colors.text, textAlign: "center" }]}>The 3D muscle model could not load.</Text>
              <FormButton label="Retry 3D Model" variant="secondary" onPress={() => setRetryGeneration((value) => value + 1)} />
            </View>
          ) : null}
          {targetRegions.map((region) => <View key={`target-${region}`} pointerEvents="none" testID={`anatomy-target-${region}`} />)}
          {secondaryRegions.map((region) => <View key={`secondary-${region}`} pointerEvents="none" testID={`anatomy-secondary-${region}`} />)}
          {issueRegions.map((region) => <View key={`issue-${region}`} pointerEvents="none" testID={`anatomy-issue-${region}`} />)}
        </View>
      </GestureDetector>
    </View>
  );
}
