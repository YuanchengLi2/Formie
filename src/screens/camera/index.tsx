import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Text, TextInput, View, type TextInputProps } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedProps, useSharedValue } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { useCaptureStore } from "@/features/capture/capture-store";
import { useCapturePreferences } from "@/features/capture/capture-preferences";
import { analysisUploadCoordinator } from "@/features/capture/analysis-upload-coordinator";
import { recordedDurationFromCapture } from "@/features/capture/countdown";
import { deviceVideoStore } from "@/features/capture/device-video-store";
import type { RecordedSet } from "@/features/capture/types";
import { captureVideoSettings } from "@/features/capture/video-settings";
import { CAMERA_LENS_HYSTERESIS, cameraZoomPresets, pinchMagnification, resolveCameraMagnification, type CameraZoomLabel } from "@/features/capture/camera-zoom";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

import { CameraControls } from "./camera-controls";

const cameraPermissionArt = require("../../../assets/production/camera-permission.png");
const AnimatedCameraView = Animated.createAnimatedComponent(CameraView);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type CameraScreenProps = {
  previousSessionId?: string;
};

export function CameraScreen({ previousSessionId }: CameraScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [availableLenses, setAvailableLenses] = useState<string[]>([]);
  const [selectedLens, setSelectedLens] = useState<string | undefined>();
  const [activeZoomLabel, setActiveZoomLabel] = useState<CameraZoomLabel | null>("1x");
  const [magnification, setMagnification] = useState(1);
  const magnificationShared = useSharedValue(1);
  const pinchStartMagnificationShared = useSharedValue(1);
  const hasUltraWideShared = useSharedValue(false);
  const pinchPhysicalDetentShared = useSharedValue("wide");
  const [pinching, setPinching] = useState(false);
  const exitRequestedRef = useRef(false);
  const requestedStopAtRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const capturePreferences = useCapturePreferences((state) => state.preferences);
  const hydrateCapturePreferences = useCapturePreferences((state) => state.hydrate);

  const phase = useCaptureStore((state) => state.phase);
  const countdown = useCaptureStore((state) => state.countdown);
  const startedAt = useCaptureStore((state) => state.startedAt);
  const recording = useCaptureStore((state) => state.recording);
  const error = useCaptureStore((state) => state.error);
  const dispatch = useCaptureStore((state) => state.dispatch);

  useEffect(() => {
    if (!permission && process.env.EXPO_OS !== "web") void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    void hydrateCapturePreferences();
  }, [hydrateCapturePreferences]);

  useEffect(() => {
    const hasUltraWide = cameraZoomPresets(availableLenses).some((preset) => preset.label === "0.5x");
    hasUltraWideShared.value = hasUltraWide;
    magnificationShared.value = magnification;
    const ultraWideLens = cameraZoomPresets(availableLenses).find((preset) => preset.label === "0.5x")?.lens;
    pinchPhysicalDetentShared.value = hasUltraWide && (
      selectedLens === ultraWideLens
      || (selectedLens === undefined && magnification < 1 - CAMERA_LENS_HYSTERESIS)
    ) ? "ultraWide" : "wide";
  }, [availableLenses, hasUltraWideShared, magnification, magnificationShared, pinchPhysicalDetentShared, selectedLens]);

  useEffect(() => {
    if (phase !== "recording" || startedAt === null) return;
    const update = () => setElapsedMs(Date.now() - startedAt);
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [phase, startedAt]);

  const startNativeRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    const actualStart = Date.now();
    requestedStopAtRef.current = null;
    dispatch({ type: "recording_started", startedAt: actualStart });
    if (capturePreferences.recordingVibrationEnabled) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: captureVideoSettings.maxDurationSeconds, codec: "avc1" });
      if (exitRequestedRef.current) return;
      if (!result?.uri) throw new Error("The camera did not save the recording");
      const saved = await deviceVideoStore.persist({
        localUri: result.uri,
        durationMs: recordedDurationFromCapture({
          startedAtMs: actualStart,
          resolvedAtMs: Date.now(),
          requestedStopAtMs: requestedStopAtRef.current,
          maxDurationMs: captureVideoSettings.maxDurationSeconds * 1_000,
        }),
        mimeType: "video/mp4",
      } satisfies RecordedSet);
      dispatch({ type: "recording_finished", recording: saved });
      router.replace("/analysis/review");
    } catch (recordingError) {
      if (exitRequestedRef.current) return;
      const current = useCaptureStore.getState();
      if (current.phase === "recording") {
        const message = recordingError instanceof Error ? recordingError.message : "Recording could not be saved";
        dispatch({ type: "recording_failed", message });
      }
    }
  }, [capturePreferences.recordingVibrationEnabled, dispatch, router]);

  useEffect(() => {
    if (phase !== "countingDown" || countdown === null) return;
    if (countdown === 0) {
      void startNativeRecording();
      return;
    }
    const timer = setTimeout(() => dispatch({ type: "countdown_tick" }), 1_000);
    return () => clearTimeout(timer);
  }, [countdown, dispatch, phase, startNativeRecording]);

  const discardRecording = () => {
    analysisUploadCoordinator.reset();
    dispatch({ type: "discard_recording" });
  };

  const closeCamera = useCallback(() => {
    exitRequestedRef.current = true;
    const stopRecording = cameraRef.current?.stopRecording;
    if (phase === "recording" && typeof stopRecording === "function") {
      stopRecording.call(cameraRef.current);
    }
    analysisUploadCoordinator.reset();
    dispatch({ type: "discard_recording" });
    router.replace({
      pathname: "/recording-tips",
      params: previousSessionId ? { previousSessionId } : {},
    });
  }, [dispatch, phase, previousSessionId, router]);

  const setCameraMagnification = useCallback((nextMagnification: number, lenses = availableLenses, preserveLensHysteresis = true) => {
    const resolved = resolveCameraMagnification(nextMagnification, lenses, preserveLensHysteresis ? selectedLens : undefined);
    magnificationShared.value = resolved.magnification;
    setMagnification(resolved.magnification);
    setSelectedLens(resolved.lens);
    setZoom(resolved.zoom);
  }, [availableLenses, magnificationShared, selectedLens]);

  const applyAvailableLenses = useCallback((lenses: string[]) => {
    setAvailableLenses(lenses);
    const hasUltraWide = cameraZoomPresets(lenses).some((preset) => preset.label === "0.5x");
    hasUltraWideShared.value = hasUltraWide;
    pinchPhysicalDetentShared.value = hasUltraWide && magnificationShared.value < 0.94 ? "ultraWide" : "wide";
    if (selectedLens === undefined) {
      setActiveZoomLabel("1x");
      setCameraMagnification(1, lenses);
    }
  }, [hasUltraWideShared, magnificationShared, pinchPhysicalDetentShared, selectedLens, setCameraMagnification]);

  const discoverAvailableLenses = useCallback(async () => {
    try {
      const lenses = await cameraRef.current?.getAvailableLensesAsync();
      if (lenses) applyAvailableLenses(lenses);
    } catch {
      // Lens presets are optional; preview and recording must remain usable.
    }
  }, [applyAvailableLenses]);

  const beginPinch = useCallback(() => {
    setPinching(true);
    setActiveZoomLabel(null);
  }, []);

  const commitPinchDetent = useCallback((nextMagnification: number) => {
    setActiveZoomLabel(null);
    setCameraMagnification(nextMagnification);
    if (capturePreferences.interactionHapticsEnabled) {
      void Haptics.selectionAsync();
    }
  }, [capturePreferences.interactionHapticsEnabled, setCameraMagnification]);

  const endPinch = useCallback((nextMagnification: number) => {
    setCameraMagnification(nextMagnification);
    setPinching(false);
  }, [setCameraMagnification]);

  const pinchGesture = useMemo(
    () => Gesture.Pinch()
      .onBegin(() => {
        pinchStartMagnificationShared.value = magnificationShared.value;
        runOnJS(beginPinch)();
      })
      .onUpdate((event) => {
        const nextMagnification = pinchMagnification(
          pinchStartMagnificationShared.value,
          event.scale,
          hasUltraWideShared.value,
        );
        magnificationShared.value = nextMagnification;
        const nextPhysicalDetent = !hasUltraWideShared.value
          ? "wide"
          : pinchPhysicalDetentShared.value === "ultraWide"
            ? nextMagnification > 1 + CAMERA_LENS_HYSTERESIS ? "wide" : "ultraWide"
            : nextMagnification < 1 - CAMERA_LENS_HYSTERESIS ? "ultraWide" : "wide";
        if (nextPhysicalDetent !== pinchPhysicalDetentShared.value) {
          pinchPhysicalDetentShared.value = nextPhysicalDetent;
          runOnJS(commitPinchDetent)(nextMagnification);
        }
      })
      .onFinalize((event) => {
        const nextMagnification = pinchMagnification(
          pinchStartMagnificationShared.value,
          event.scale,
          hasUltraWideShared.value,
        );
        runOnJS(endPinch)(nextMagnification);
      }),
    [beginPinch, commitPinchDetent, endPinch, hasUltraWideShared, magnificationShared, pinchPhysicalDetentShared, pinchStartMagnificationShared],
  );

  const animatedCameraProps = useAnimatedProps(() => {
    const current = magnificationShared.value;
    const zoomValue = hasUltraWideShared.value && current < 1
      ? Math.max(0, ((current - 0.5) / 0.5) * 0.12)
      : Math.max(0, (current - 1) * 0.12);
    return { zoom: Math.min(1, zoomValue) };
  });

  const animatedMagnificationLabelProps = useAnimatedProps(() => ({
    text: `${magnificationShared.value.toFixed(1)}x`,
  })) as unknown as Partial<TextInputProps>;

  if (permission && !permission.granted) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.xl, padding: spacing.xl, backgroundColor: colors.background }}>
        <Image accessibilityLabel="Camera access illustration" source={cameraPermissionArt} contentFit="contain" style={{ width: 190, height: 150 }} />
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <Text selectable style={[typography.title, { color: colors.text, textAlign: "center" }]}>Camera access</Text>
          <Text selectable style={[typography.body, { maxWidth: 300, color: colors.textSecondary, textAlign: "center" }]}>Formie needs the camera to record and privately analyze your movement.</Text>
        </View>
        {permission.canAskAgain ? (
          <FormButton style={{ alignSelf: "stretch" }} label="Allow Camera" onPress={() => void requestPermission()} />
        ) : (
          <FormButton style={{ alignSelf: "stretch" }} label="Open Settings" onPress={() => void Linking.openSettings()} />
        )}
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>▣  Your recordings are private.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cameraBlack }}>
      <GestureDetector gesture={pinchGesture}>
        <AnimatedCameraView
          ref={cameraRef}
          accessibilityLabel="Camera preview"
          active
          enableTorch={torch}
          facing={facing}
          mirror={facing === "front"}
          mode="video"
          mute
          onAvailableLensesChanged={({ lenses }) => applyAvailableLenses(lenses)}
          onCameraReady={() => void discoverAvailableLenses()}
          selectedLens={selectedLens}
          style={{ flex: 1 }}
          animatedProps={animatedCameraProps}
          videoBitrate={captureVideoSettings.bitrate}
          videoQuality={captureVideoSettings.quality}
          videoStabilizationMode="auto"
          zoom={zoom}
        />
      </GestureDetector>

      {pinching ? (
        <AnimatedTextInput
          accessibilityLabel="Live camera magnification"
          editable={false}
          pointerEvents="none"
          animatedProps={animatedMagnificationLabelProps}
          style={{ position: "absolute", alignSelf: "center", bottom: insets.bottom + 176, minWidth: 72, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.7)", color: colors.text, textAlign: "center", fontVariant: ["tabular-nums"] }}
        />
      ) : null}

      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + spacing.md, left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable
          accessibilityLabel="Close camera"
          accessibilityState={{ disabled: false }}
          onPress={closeCamera}
          style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(0,0,0,0.58)" }}
        >
          <Text selectable style={{ color: colors.text, fontSize: 24 }}>×</Text>
        </Pressable>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable accessibilityLabel="Toggle light" onPress={() => setTorch((value) => !value)} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(0,0,0,0.58)" }}>
            <Text selectable style={{ color: torch ? colors.gold : colors.text, fontSize: 18 }}>ϟ</Text>
          </Pressable>
          <Pressable accessibilityLabel="Flip camera" onPress={() => {
            setFacing((value) => (value === "back" ? "front" : "back"));
            setAvailableLenses([]);
            setSelectedLens(undefined);
            setActiveZoomLabel("1x");
            hasUltraWideShared.value = false;
            magnificationShared.value = 1;
            setCameraMagnification(1, [], false);
          }} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(0,0,0,0.58)" }}>
            <Text selectable style={{ color: colors.text, fontSize: 18 }}>↻</Text>
          </Pressable>
        </View>
      </View>

      <CameraControls
        phase={phase}
        countdown={countdown}
        elapsedMs={elapsedMs}
        error={error}
        hasRecording={Boolean(recording?.localUri)}
        onRecord={() => {
          exitRequestedRef.current = false;
          setElapsedMs(0);
          dispatch({ type: "begin_countdown", previousSessionId, countdownSeconds: capturePreferences.countdownSeconds });
        }}
        onStop={() => {
          requestedStopAtRef.current = Date.now();
          cameraRef.current?.stopRecording();
        }}
        onRetryUpload={() => undefined}
        onDiscardRecording={discardRecording}
        zoomed={Math.abs(magnification - 1) > 0.01}
        zoomPresets={cameraZoomPresets(availableLenses).map((preset) => preset.label)}
        activeZoomLabel={activeZoomLabel}
        onSelectZoom={(label) => {
          setActiveZoomLabel(label);
          setCameraMagnification(Number.parseFloat(label), availableLenses, false);
        }}
        onResetZoom={() => {
          setActiveZoomLabel("1x");
          setCameraMagnification(1, availableLenses, false);
        }}
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
    </View>
  );
}
