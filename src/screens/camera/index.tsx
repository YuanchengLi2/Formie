import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useAudioPlayer } from "expo-audio";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormButton } from "@/components/form-button";
import {
  completeAnalysisUpload,
  createAnalysisSession,
  uploadAnalysisVideo,
} from "@/features/analysis/api";
import { useCaptureStore } from "@/features/capture/capture-store";
import { START_BEEP_URI } from "@/features/capture/start-beep";
import type { CaptureOrientation, RecordedSet, UploadTarget } from "@/features/capture/types";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

import { CameraControls } from "./camera-controls";

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
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [torch, setTorch] = useState(false);
  const [availableLenses, setAvailableLenses] = useState<string[]>([]);
  const [selectedLens, setSelectedLens] = useState<string | undefined>();
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
        let target = existingTarget ?? null;
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

  const startNativeRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    const actualStart = Date.now();
    dispatch({ type: "recording_started", startedAt: actualStart });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void beep.seekTo(0).then(() => beep.play());

    try {
      const orientation = await ScreenOrientation.getOrientationAsync().catch(() => ScreenOrientation.Orientation.UNKNOWN);
      const result = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (!result?.uri) throw new Error("The camera did not save the recording");
      const saved: RecordedSet = {
        localUri: result.uri,
        durationMs: Date.now() - actualStart,
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
    dispatch({ type: "reset" });
  };

  const cameraCanClose = phase === "idle" || phase === "countingDown" || phase === "error";

  if (permission && !permission.granted) {
    return (
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.xl, padding: spacing.xl, backgroundColor: colors.background }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Camera access is needed</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>FORM uses the camera only to record the exercise set you choose to analyze.</Text>
        {permission.canAskAgain ? (
          <FormButton label="Allow Camera" onPress={() => void requestPermission()} />
        ) : (
          <FormButton label="Open Settings" onPress={() => void Linking.openSettings()} />
        )}
      </View>
    );
  }

  const ultraWideLens = availableLenses.find((lens) => lens.toLowerCase().includes("ultrawide"));

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
          if (!selectedLens) setSelectedLens(lenses.find((lens) => lens.toLowerCase().includes("wideangle")) ?? lenses[0]);
        }}
        selectedLens={selectedLens}
        style={{ flex: 1 }}
        videoQuality="1080p"
        videoStabilizationMode="auto"
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
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {ultraWideLens ? (
            <Pressable
              accessibilityLabel="Use 0.5x lens"
              onPress={() => setSelectedLens(selectedLens === ultraWideLens ? availableLenses.find((lens) => lens.toLowerCase().includes("wideangle")) : ultraWideLens)}
              style={{ minWidth: 48, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(0,0,0,0.58)" }}
            >
              <Text selectable style={[typography.label, { color: selectedLens === ultraWideLens ? colors.gold : colors.text }]}>0.5x</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel="Toggle light" onPress={() => setTorch((value) => !value)} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(0,0,0,0.58)" }}>
            <Text selectable style={{ color: torch ? colors.gold : colors.text, fontSize: 18 }}>ϟ</Text>
          </Pressable>
          <Pressable accessibilityLabel="Flip camera" onPress={() => setFacing((value) => (value === "back" ? "front" : "back"))} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(0,0,0,0.58)" }}>
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
        }}
        onStop={() => cameraRef.current?.stopRecording()}
        onRetryUpload={retryUpload}
        onDiscardRecording={discardRecording}
      />
    </View>
  );
}
