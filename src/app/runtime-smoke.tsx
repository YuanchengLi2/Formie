import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { AnatomyModel } from "@/components/anatomy-model";
import { MovementScoreCard } from "@/components/movement-score-card";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

const movementScores = [
  { id: "torso-stability", label: "Torso Stability", score: 82, observed: "The pelvis slides away from the backrest.", evidenceIds: [] },
  { id: "range-of-motion", label: "Range of Motion", score: 66, observed: "The dumbbells do not lower deep enough.", evidenceIds: [] },
  { id: "lowering-control", label: "Lowering Control", score: 78, observed: "The return stays controlled.", evidenceIds: [] },
  { id: "rep-consistency", label: "Rep Consistency", score: 72, observed: "The final repetitions change slightly.", evidenceIds: [] },
];

export default function RuntimeSmokeRoute() {
  const [component, setComponent] = useState<"loading" | "model" | "score">("loading");

  useEffect(() => {
    const sentinel = `${FileSystem.documentDirectory}runtime-smoke-score`;
    void FileSystem.getInfoAsync(sentinel).then(async ({ exists }) => {
      if (exists) {
        setComponent("score");
        return;
      }
      await FileSystem.writeAsStringAsync(sentinel, "next-launch-renders-score");
      setComponent("model");
    });
  }, []);

  return (
    <ScrollView contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingTop: 72, backgroundColor: colors.background }}>
      <Text testID="runtime-smoke-title" style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>Runtime smoke: {component}</Text>
      {component === "score"
        ? <MovementScoreCard score={74} movementScores={movementScores} />
        : component === "model" ? <View style={{ gap: spacing.md }}>
          <AnatomyModel targetRegions={["chest", "triceps"]} secondaryRegions={["front_shoulders"]} issueRegions={["shoulders"]} />
        </View> : null}
    </ScrollView>
  );
}
