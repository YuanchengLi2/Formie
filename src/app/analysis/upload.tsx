import { useEffect } from "react";
import { useRouter } from "expo-router";

import { getAnalysisStatus } from "@/features/analysis/api";
import { getAccessToken } from "@/features/auth/access-token";
import { useAuth } from "@/features/auth/auth-provider";
import { analysisUploadCoordinator } from "@/features/capture/analysis-upload-coordinator";
import { createAnalysisClientRequestId, getAnalysisRecoveryStore } from "@/features/capture/analysis-recovery-store";
import { useCaptureStore } from "@/features/capture/capture-store";
import { AnalysisProgressScreen } from "@/screens/analysis-progress";

export default function AnalysisUploadRoute() {
  const router = useRouter();
  const auth = useAuth();
  const phase = useCaptureStore((state) => state.phase);
  const recording = useCaptureStore((state) => state.recording);
  const declaration = useCaptureStore((state) => state.declaration);
  const previousSessionId = useCaptureStore((state) => state.previousSessionId);
  const uploadRequestId = useCaptureStore((state) => state.uploadRequestId);
  const recoveredSessionId = useCaptureStore((state) => state.sessionId);
  const uploadSubstage = useCaptureStore((state) => state.uploadSubstage);
  const error = useCaptureStore((state) => state.error);
  const dispatch = useCaptureStore((state) => state.dispatch);

  useEffect(() => {
    if (phase !== "uploading" || !recording || !declaration || !uploadRequestId || !auth.user?.id) return;
    let active = true;
    const userId = auth.user.id;
    const recovery = getAnalysisRecoveryStore();
    const saveUpload = (sessionId: string | null) => recovery.saveUpload({
      userId,
      recording,
      declaration,
      previousSessionId,
      clientRequestId: uploadRequestId,
      sessionId,
    });
    const fail = async (failure: unknown) => {
      if (!active) return;
      const message = failure instanceof Error ? failure.message : "The original video could not be uploaded";
      await recovery.markUploadFailed(message).catch(() => undefined);
      if (active) dispatch({ type: "upload_failed", message });
    };
    const continueToAnalysis = async (sessionId: string) => {
      await recovery.markProcessing(userId, sessionId).catch(() => undefined);
      if (!active) return;
      dispatch({ type: "processing", sessionId });
      router.replace({ pathname: "/analysis/[session-id]", params: { "session-id": sessionId } });
    };
    const unsubscribe = analysisUploadCoordinator.subscribe((progress) => {
      if (!active) return;
      dispatch({ type: "upload_progress", substage: progress.substage, target: progress.target });
      if (progress.target) void saveUpload(progress.target.sessionId).catch(() => undefined);
    });

    void (async () => {
      if (recoveredSessionId) {
        const accessToken = await getAccessToken();
        const durable = await getAnalysisStatus({ accessToken, sessionId: recoveredSessionId });
        if (durable.status === "failed") {
          throw new Error(durable.failureReason ?? "Formie couldn't finish this upload. Retry to resume it.");
        }
        if (durable.status !== "created" && durable.status !== "uploading") {
          await continueToAnalysis(recoveredSessionId);
          return;
        }
      }
      const { sessionId, target } = await analysisUploadCoordinator.run(
        recording,
        declaration,
        previousSessionId ?? undefined,
        { clientRequestId: uploadRequestId },
      );
      if (!active) return;
      if (!useCaptureStore.getState().uploadTarget) dispatch({ type: "upload_target_created", target });
      await continueToAnalysis(sessionId);
    })().catch(fail);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth.user?.id, declaration, dispatch, phase, previousSessionId, recording, recoveredSessionId, router, uploadRequestId]);

  const discard = () => {
    void analysisUploadCoordinator.cancelUpload().finally(async () => {
      await getAnalysisRecoveryStore().clear().catch(() => undefined);
      dispatch({ type: "discard_recording" });
      router.replace("/camera");
    });
  };

  const retry = async () => {
    if (!recording || !declaration || !auth.user?.id) return;
    const clientRequestId = uploadRequestId ?? createAnalysisClientRequestId();
    try {
      await getAnalysisRecoveryStore().saveUpload({
        userId: auth.user.id,
        recording,
        declaration,
        previousSessionId,
        clientRequestId,
        sessionId: recoveredSessionId,
      });
      analysisUploadCoordinator.reset();
      dispatch({ type: "retry_upload", clientRequestId });
    } catch {
      dispatch({ type: "upload_recovered", recording, declaration, previousSessionId, clientRequestId, sessionId: recoveredSessionId, error: "Formie could not safely resume this upload. Check device storage and try again." });
    }
  };

  const missingRecording = !recording || !declaration
    ? "The saved recording or set details are no longer available."
    : !uploadRequestId || !auth.user?.id
      ? "The saved upload identity is unavailable. Record again to start a safe upload."
      : null;
  const failureMessage = phase === "error" ? error : missingRecording;

  return (
    <AnalysisProgressScreen
      mode="upload"
      stage={uploadSubstage ?? "creating_session"}
      failureMessage={failureMessage}
      onRetryUpload={phase === "error" && recording && declaration ? () => void retry() : undefined}
      onRecordAgain={failureMessage ? discard : undefined}
      onGoHome={missingRecording ? () => void getAnalysisRecoveryStore().clear().finally(() => router.replace("/(tabs)/(home)")) : undefined}
    />
  );
}
