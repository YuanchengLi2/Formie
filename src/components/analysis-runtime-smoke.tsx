import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ResultsScreen } from "@/screens/results";
import { analysisResultSchema, type AnalysisResult } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

const AFFECTED_SAVED_RESULT: AnalysisResult = analysisResultSchema.parse({
  status: "complete",
  recognition: {
    label: "Standing Curl",
    variation: null,
    equipment: [],
    confidence: 1,
    alternatives: [],
    catalogExerciseId: null,
    exerciseFamily: "curl",
  },
  overallAssessment: "The set was reviewed and the movement stayed readable.",
  muscleFocus: ["Biceps", "Forearms"],
  coachNote: "Keep the upper arms steady.",
  score: 82,
  scoreRationale: [],
  didWell: [],
  priorityCorrections: [{
    id: "smoke-correction",
    coachingArea: "form",
    title: "Keep the upper arms still",
    detail: "The upper arms move forward during the curl.",
    whyItMatters: "A stable upper arm keeps the path repeatable.",
    correction: "Keep the upper arms beside the torso.",
    cue: "Pin the elbows.",
    actionableCorrection: {
      instruction: "Keep the upper arms beside the torso.",
      cue: "Pin the elbows.",
      successCheck: "The elbows stay beside the torso.",
      applyWhen: "During the next repetition.",
    },
    severity: "important",
    evidence: [{
      startMs: 500,
      peakMs: 800,
      endMs: 1_100,
      repNumber: null,
      phase: "concentric",
      visualEvidence: "The upper arms move forward during the curl.",
      visibleBodyAreas: ["upper arms", "elbows"],
      confidence: 0.9,
    }],
  }],
  coachingCues: [],
  setContext: { cameraView: "front" },
  setSummary: { totalReps: 8 },
  nextSetPlan: [{
    id: "smoke-plan",
    action: "Keep the upper arms beside the torso.",
    rationale: "A stable upper arm keeps the path repeatable.",
    relatedFindingId: "smoke-correction",
  }],
  comparison: null,
});

export function AnalysisRuntimeSmoke() {
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const transition = setTimeout(() => setResult(AFFECTED_SAVED_RESULT), 0);
    return () => clearTimeout(transition);
  }, []);

  return (
    <View testID="analysis-runtime-smoke" style={{ flex: 1, backgroundColor: colors.background }}>
      {result === null ? (
        <View testID="analysis-runtime-loading" style={{ flex: 1, justifyContent: "center", padding: spacing.lg }}>
          <Text style={{ color: colors.text }}>Opening analysis…</Text>
        </View>
      ) : (
        <View testID="analysis-runtime-results" style={{ flex: 1 }}>
          <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
            <ResultsScreen result={result} onRecordAnother={() => undefined} exampleState="error" />
          </SafeAreaProvider>
        </View>
      )}
    </View>
  );
}
