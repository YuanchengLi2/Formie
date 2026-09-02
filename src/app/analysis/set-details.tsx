import { useCallback, useEffect, useState } from "react";
import { BackHandler } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";

import { analysisUploadCoordinator } from "@/features/capture/analysis-upload-coordinator";
import { useCaptureStore } from "@/features/capture/capture-store";
import type { SetDeclaration } from "@/features/analysis/set-declaration";
import { AiProcessingConsentModal } from "@/components/ai-processing-consent-modal";
import {
  acceptAiProcessingConsent,
  currentAiProcessingConsent,
  isCurrentAiProcessingConsent,
  type AiConsentClient,
} from "@/features/privacy/ai-consent";
import { supabase } from "@/lib/supabase";
import { SetDeclarationScreen } from "@/screens/set-declaration";

export default function AnalysisSetDetailsRoute() {
  const router = useRouter();
  const phase = useCaptureStore((state) => state.phase);
  const recording = useCaptureStore((state) => state.recording);
  const declaration = useCaptureStore((state) => state.declaration);
  const exerciseChoice = useCaptureStore((state) => state.exerciseChoice);
  const previousSessionId = useCaptureStore((state) => state.previousSessionId);
  const dispatch = useCaptureStore((state) => state.dispatch);
  const [consentCurrent, setConsentCurrent] = useState(false);
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [pendingDeclaration, setPendingDeclaration] = useState<SetDeclaration | null>(null);
  const consentClient = supabase as unknown as AiConsentClient;

  useEffect(() => {
    let active = true;
    void currentAiProcessingConsent(consentClient)
      .then((consent) => {
        if (active) setConsentCurrent(isCurrentAiProcessingConsent(consent));
      })
      .catch(() => {
        if (active) setConsentCurrent(false);
      });
    return () => { active = false; };
  }, [consentClient]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/analysis/review");
      return true;
    });
    return () => subscription.remove();
  }, [router]));

  if (!recording || (phase !== "recorded" && phase !== "error")) {
    return <Redirect href="/camera" />;
  }

  const retake = () => {
    analysisUploadCoordinator.reset();
    dispatch({ type: "discard_recording" });
    router.replace({
      pathname: "/recording-tips",
      params: previousSessionId ? { previousSessionId } : {},
    });
  };

  const beginUpload = (submitted: SetDeclaration) => {
    dispatch({ type: "declaration_submitted", declaration: submitted });
    dispatch({ type: "upload_started" });
    router.replace("/analysis/upload");
  };

  const analyze = (submitted: SetDeclaration) => {
    if (consentCurrent) {
      beginUpload(submitted);
      return;
    }
    setPendingDeclaration(submitted);
    setConsentError(null);
    setConsentModalVisible(true);
  };

  const agreeAndAnalyze = async () => {
    if (!pendingDeclaration || consentSaving) return;
    setConsentSaving(true);
    setConsentError(null);
    try {
      await acceptAiProcessingConsent(consentClient);
      const submitted = pendingDeclaration;
      setConsentCurrent(true);
      setConsentModalVisible(false);
      setPendingDeclaration(null);
      beginUpload(submitted);
    } catch (error) {
      setConsentError(error instanceof Error ? error.message : "Consent could not be saved. Try again.");
    } finally {
      setConsentSaving(false);
    }
  };

  return (
    <>
      <SetDeclarationScreen
        localVideoUri={recording.localUri}
        onBack={() => router.replace("/analysis/review")}
        initialDeclaration={declaration}
        preselectedExercise={exerciseChoice.kind === "selected" ? exerciseChoice : null}
        initialExerciseName={exerciseChoice.kind === "custom" ? exerciseChoice.canonicalName : undefined}
        analyzeLabel={consentCurrent ? "Analyze this video" : "Review AI processing"}
        showVideoPreview={false}
        onChangeExercise={() => router.push({ pathname: "/exercise-selection", params: { mode: "review" } })}
        onAnalyze={analyze}
        onRetake={retake}
      />
      <AiProcessingConsentModal
        agreeing={consentSaving}
        error={consentError}
        onAgree={() => { void agreeAndAnalyze(); }}
        onDismiss={() => {
          if (consentSaving) return;
          setConsentModalVisible(false);
          setPendingDeclaration(null);
        }}
        visible={consentModalVisible}
      />
    </>
  );
}
