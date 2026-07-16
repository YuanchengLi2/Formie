import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useAudioPlayer } from "expo-audio";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { FormButton } from "@/components/form-button";
import { FormWordmark } from "@/components/form-wordmark";
import { useCaptureStore } from "@/features/capture/capture-store";
import { analysisUploadCoordinator } from "@/features/capture/analysis-upload-coordinator";
import { normalizeRecordedDuration } from "@/features/capture/countdown";
import { START_BEEP_URI } from "@/features/capture/start-beep";
import type { RecordedSet } from "@/features/capture/types";
import { captureVideoSettings } from "@/features/capture/video-settings";
import { pinchZoom } from "@/features/capture/camera-zoom";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

import { CameraControls } from "./camera-controls";

const cameraPermissionArt = require("../../../assets/production/camera-permission.png");

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
  const zoomRef = useRef(0);
  const pinchStartZoomRef = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const beep = useAudioPlayer({ uri: START_BEEP_URI });

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
    if (phase !== "recording" || startedAt === null) return;
    const update = () => setElapsedMs(Date.now() - startedAt);
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [phase, startedAt]);

  const prepareUploadTarget = useCallback((repeatSessionId?: string) => {
    return analysisUploadCoordinator.prepare(repeatSessionId);
  }, []);

  const startNativeRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    const actualStart = Date.now();
    dispatch({ type: "recording_started", startedAt: actualStart });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void beep.seekTo(0).then(() => beep.play());

    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: captureVideoSettings.maxDurationSeconds });
      if (!result?.uri) throw new Error("The camera did not save the recording");
      const saved: RecordedSet = {
        localUri: result.uri,
        durationMs: normalizeRecordedDuration(Date.now() - actualStart),
        mimeType: "video/mp4",
      };
      dispatch({ type: "recording_finished", recording: saved });
      dispatch({ type: "upload_started" });
      router.replace("/analysis/upload");
    } catch (recordingError) {
      const current = useCaptureStore.getState();
      if (current.phase === "recording") {
        const message = recordingError instanceof Error ? recordingError.message : "Recording could not be saved";
        dispatch({ type: "recording_failed", message });
      }
    }
  }, [beep, dispatch, router]);

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
    dispatch({ type: "reset" });
  };

  const cameraCanClose = phase === "idle" || phase === "countingDown" || phase === "error";

  const setCameraZoom = useCallback((nextZoom: number) => {
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
  }, []);

  const pinchGesture = useMemo(
    () => Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => {
        pinchStartZoomRef.current = zoomRef.current;
      })
      .onUpdate((event) => {
        setCameraZoom(pinchZoom(pinchStartZoomRef.current, event.scale));
      }),
    [setCameraZoom],
  );

  if (permission && !permission.granted) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.xl, padding: spacing.xl, backgroundColor: colors.background }}>
        <Image accessibilityLabel="Camera access illustration" source={cameraPermissionArt} contentFit="contain" style={{ width: 190, height: 150 }} />
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <Text selectable style={[typography.title, { color: colors.text, textAlign: "center" }]}>Camera access</Text>
          <Text selectable style={[typography.body, { maxWidth: 300, color: colors.textSecondary, textAlign: "center" }]}>FORM needs the camera to record and privately analyze your movement.</Text>
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
      <CameraView
        ref={cameraRef}
        active
        enableTorch={torch}
        facing={facing}
        mirror={facing === "front"}
        mode="video"
        mute
        style={{ flex: 1 }}
        videoQuality={captureVideoSettings.quality}
        videoStabilizationMode="auto"
        zoom={zoom}
      />
      <GestureDetector gesture={pinchGesture}>
        <View accessibilityLabel="Pinch camera preview to zoom" collapsable={false} style={{ position: "absolute", inset: 0 }} />
      </GestureDetector>

      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + spacing.md, left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable
          accessibilityLabel="Close camera"
          accessibilityState={{ disabled: !cameraCanClose }}
          disabled={!cameraCanClose}
          onPress={() => {
            dispatch({ type: "reset" });
            router.back();
          }}
          style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(0,0,0,0.58)", opacity: cameraCanClose ? 1 : 0.45 }}
        >
          <Text selectable style={{ color: colors.text, fontSize: 24 }}>×</Text>
        </Pressable>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 12, alignItems: "center" }}>
          <FormWordmark />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable accessibilityLabel="Toggle light" onPress={() => setTorch((value) => !value)} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(0,0,0,0.58)" }}>
            <Text selectable style={{ color: torch ? colors.gold : colors.text, fontSize: 18 }}>ϟ</Text>
          </Pressable>
          <Pressable accessibilityLabel="Flip camera" onPress={() => {
            setFacing((value) => (value === "back" ? "front" : "back"));
            setCameraZoom(0);
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
          setElapsedMs(0);
          dispatch({ type: "begin_countdown", previousSessionId });
          void prepareUploadTarget(previousSessionId);
        }}
        onStop={() => cameraRef.current?.stopRecording()}
        onRetryUpload={() => undefined}
        onDiscardRecording={discardRecording}
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
    </View>
  );
}
