import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";

import { findResultFinding } from "@/features/analysis/result-store";
import { useAnalysisStatus } from "@/features/analysis/use-analysis-status";
import { useCaptureStore } from "@/features/capture/capture-store";
import { FindingDetailScreen } from "@/screens/finding-detail";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export default function FindingDetailRoute() {
  const router = useRouter();
  const { "session-id": sessionId = "", "finding-id": findingId = "" } = useLocalSearchParams<{ "session-id": string; "finding-id": string }>();
  const status = useAnalysisStatus(sessionId, { includeVideoUrl: true, mode: "status" });
  const resetCapture = useCaptureStore((state) => state.dispatch);
  const finding = status.data?.result ? findResultFinding(status.data.result, findingId) : null;

  if (!finding) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background }}>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Loading coaching evidence…</Text>
      </View>
    );
  }

  return (
    <FindingDetailScreen
      finding={finding}
      videoUrl={status.data?.videoUrl ?? null}
      onRecordAnother={() => {
        resetCapture({ type: "reset" });
        router.replace({ pathname: "/recording-tips", params: { previousSessionId: sessionId } });
      }}
    />
  );
}
