import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useAudioPlayer } from "expo-audio";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormButton } from "@/components/form-button";
import { FormWordmark } from "@/components/form-wordmark";
import { ProductionIcon } from "@/components/production-icon";
import {
  completeAnalysisUpload,
  createAnalysisSession,
  uploadAnalysisVideo,
} from "@/features/analysis/api";
import { useCaptureStore } from "@/features/capture/capture-store";
import { normalizeRecordedDuration } from "@/features/capture/countdown";
import { START_BEEP_URI } from "@/features/capture/start-beep";
import type { CaptureOrientation, RecordedSet, UploadTarget } from "@/features/capture/types";
import { captureVideoSettings } from "@/features/capture/video-settings";
import { cameraZoomPresets, resolveCameraZoom, type CameraZoomLabel } from "@/features/capture/camera-zoom";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

import { CameraControls } from "./camera-controls";

const cameraPermissionArt = require("../../../assets/production/camera-permission.png");

type CameraScreenProps = {
  previousSessionId?: string;
};

function captureOrientation(value: ScreenOrientation.Orientation): CaptureOrientation {
  switch (value) {
    case ScreenOrientation.Orientation.PORTRAIT_UP:
      return "portraitUp";
    case ScreenOrientation.Orientation.PORTRAIT_DOWN:
      return "portraitDown";
    case ScreenOrientation.Orientation.LANDSCAPE_LEFT:
      return "landscapeLeft";
    case ScreenOrientation.Orientation.LANDSCAPE_RIGHT:
      return "landscapeRight";
    default:
      return "unknown";
  }
}

async function getAccessToken(): Promise<string> {
  const existing = await supabase.auth.getSession();
  if (existing.data.session?.access_token) return existing.data.session.access_token;

  const created = await supabase.auth.signInAnonymously();
  if (created.error || !created.data.session?.access_token) {
    throw new Error(created.error?.message ?? "A private session could not be created");
  }
  return created.data.session.access_token;
}

export function CameraScreen({ previousSessionId }: CameraScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const preparedUploadRef = useRef<Promise<UploadTarget | null> | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [torch, setTorch] = useState(false);
  const [availableLenses, setAvailableLenses] = useState<string[]>([]);
  const [selectedLens, setSelectedLens] = useState<string | undefined>();
  const [zoomLabel, setZoomLabel] = useState<CameraZoomLabel>("1x");
  const [zoom, setZoom] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const beep = useAudioPlayer({ uri: START_BEEP_URI });

  const phase = useCaptureStore((state) => state.phase);
  const countdown = useCaptureStore((state) => state.countdown);
  const startedAt = useCaptureStore((state) => state.startedAt);
  const recording = useCaptureStore((state) => state.recording);
  const uploadTarget = useCaptureStore((state) => state.uploadTarget);
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

  const uploadRecording = useCallback(
    async (saved: RecordedSet, existingTarget?: UploadTarget | null) => {
      try {
        const accessToken = await getAccessToken();
        let target = existingTarget ?? useCaptureStore.getState().uploadTarget ?? null;
        if (!target && preparedUploadRef.current) target = await preparedUploadRef.current;
        if (!target) {
          const session = await createAnalysisSession({ accessToken, previousSessionId });
          target = {
            sessionId: session.sessionId,
            signedUrl: session.upload.signedUrl,
            uploadToken: session.upload.token,
            path: session.upload.path,
          };
          dispatch({ type: "upload_target_created", target });
        }
        await uploadAnalysisVideo({
          localUri: saved.localUri,
          signedUrl: target.signedUrl,
          uploadToken: target.uploadToken,
        });
        await completeAnalysisUpload({
          accessToken,
          sessionId: target.sessionId,
          durationMs: saved.durationMs,
          captureOrientation: saved.captureOrientation,
          cameraFacing: saved.cameraFacing,
          cameraLens: saved.cameraLens,
        });
        dispatch({ type: "processing", sessionId: target.sessionId });
        router.replace({ pathname: "/analysis/[session-id]", params: { "session-id": target.sessionId } });
      } catch (uploadError) {
        dispatch({
          type: "upload_failed",
          message: uploadError instanceof Error ? uploadError.message : "The original video could not be uploaded",
        });
      }
    },
    [dispatch, previousSessionId, router],
  );

  const prepareUploadTarget = useCallback((repeatSessionId?: string) => {
    if (preparedUploadRef.current) return preparedUploadRef.current;
    preparedUploadRef.current = (async () => {
      try {
        const accessToken = await getAccessToken();
        const session = await createAnalysisSession({ accessToken, previousSessionId: repeatSessionId });
        const target: UploadTarget = {
          sessionId: session.sessionId,
          signedUrl: session.upload.signedUrl,
          uploadToken: session.upload.token,
          path: session.upload.path,
        };
        const current = useCaptureStore.getState();
        if (["countingDown", "recording", "recorded", "uploading"].includes(current.phase)) dispatch({ type: "upload_target_created", target });
        return target;
      } catch {
        return null;
      }
    })();
    return preparedUploadRef.current;
  }, [dispatch]);

  const startNativeRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    const actualStart = Date.now();
    dispatch({ type: "recording_started", startedAt: actualStart });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void beep.seekTo(0).then(() => beep.play());

    try {
      const orientation = await ScreenOrientation.getOrientationAsync().catch(() => ScreenOrientation.Orientation.UNKNOWN);
      const result = await cameraRef.current.recordAsync({ maxDuration: captureVideoSettings.maxDurationSeconds });
      if (!result?.uri) throw new Error("The camera did not save the recording");
      const saved: RecordedSet = {
        localUri: result.uri,
        durationMs: normalizeRecordedDuration(Date.now() - actualStart),
        mimeType: "video/mp4",
        captureOrientation: captureOrientation(orientation),
        cameraFacing: facing,
        cameraLens: selectedLens ?? null,
      };
      dispatch({ type: "recording_finished", recording: saved });
      dispatch({ type: "upload_started" });
      await uploadRecording(saved);
    } catch (recordingError) {
      const current = useCaptureStore.getState();
      if (current.phase === "recording") {
        const message = recordingError instanceof Error ? recordingError.message : "Recording could not be saved";
        dispatch({ type: "recording_failed", message });
      }
    }
  }, [beep, dispatch, facing, selectedLens, uploadRecording]);

  useEffect(() => {
    if (phase !== "countingDown" || countdown === null) return;
    if (countdown === 0) {
      void startNativeRecording();
      return;
    }
    const timer = setTimeout(() => dispatch({ type: "countdown_tick" }), 1_000);
    return () => clearTimeout(timer);
  }, [countdown, dispatch, phase, startNativeRecording]);

  const retryUpload = () => {
    if (!recording?.localUri) return;
    dispatch({ type: "retry_upload" });
    void uploadRecording(recording, uploadTarget);
  };

  const discardRecording = () => {
    preparedUploadRef.current = null;
    dispatch({ type: "reset" });
  };

  const cameraCanClose = phase === "idle" || phase === "countingDown" || phase === "error";

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

  const zoomPresets = cameraZoomPresets(availableLenses);

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
        onAvailableLensesChanged={({ lenses }) => {
          setAvailableLenses(lenses);
          if (!selectedLens) {
            const initial = resolveCameraZoom("1x", lenses);
            setSelectedLens(initial.lens);
            setZoom(initial.zoom);
          }
        }}
        selectedLens={selectedLens}
        style={{ flex: 1 }}
        videoQuality={captureVideoSettings.quality}
        videoStabilizationMode="auto"
        zoom={zoom}
      />

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
            setZoomLabel("1x");
            setZoom(0);
            setSelectedLens(undefined);
          }} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(0,0,0,0.58)" }}>
            <Text selectable style={{ color: colors.text, fontSize: 18 }}>↻</Text>
          </Pressable>
        </View>
      </View>

      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 62, left: 0, right: 0, alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.62)" }}>
          <ProductionIcon name="setupZoom" label="Camera zoom options" size={25} tintColor={colors.textSecondary} />
          {zoomPresets.map((preset) => (
            <Pressable
              accessibilityLabel={`Set camera zoom to ${preset.label}`}
              accessibilityRole="button"
              key={preset.label}
              onPress={() => {
                setZoomLabel(preset.label);
                setSelectedLens(preset.lens);
                setZoom(preset.zoom);
              }}
              style={{ minWidth: 44, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: zoomLabel === preset.label ? colors.gold : "transparent" }}
            >
              <Text selectable style={[typography.label, { color: zoomLabel === preset.label ? colors.background : colors.text }]}>{preset.label}</Text>
            </Pressable>
          ))}
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
        onRetryUpload={retryUpload}
        onDiscardRecording={discardRecording}
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
    </View>
  );
}
