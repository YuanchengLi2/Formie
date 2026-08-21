import { Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { scoreLetterGrade } from "@/features/analysis/score-grade";
import type { MovementScore } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ScoreIconKind = "path" | "stability" | "range" | "control" | "consistency" | "movement";

const ICON_LABEL: Record<ScoreIconKind, string> = {
  path: "Path icon",
  stability: "Stability icon",
  range: "Range icon",
  control: "Control icon",
  consistency: "Consistency icon",
  movement: "Movement icon",
};

export function movementScoreIconKind(score: Pick<MovementScore, "id" | "label">): ScoreIconKind {
  const words = `${score.id} ${score.label}`.toLowerCase();
  if (/path|align|track|trajectory/.test(words)) return "path";
  if (/stabil|balance|setup|shoulder|torso/.test(words)) return "stability";
  if (/range|depth|position|endpoint/.test(words)) return "range";
  if (/tempo|control|lower|speed/.test(words)) return "control";
  if (/consisten|repeat|symmetr|\brep\b/.test(words)) return "consistency";
  return "movement";
}

function ScoreIcon({ score }: { score: MovementScore }) {
  const kind = movementScoreIconKind(score);
  const common = { stroke: colors.gold, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <View
      accessibilityLabel={ICON_LABEL[kind]}
      accessibilityRole="image"
      testID={`movement-score-icon-${score.id}`}
      style={{ width: 48, height: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldSoft, backgroundColor: colors.surfaceRaised }}
    >
      <Svg width={28} height={28} viewBox="0 0 28 28" accessibilityElementsHidden>
        {kind === "path" ? <>
          <Path d="M6 22C6 12 12 17 12 8C12 5.8 13.5 4 16 4" fill="none" {...common} />
          <Path d="M12.5 6.2 16 3l3.5 3.2" fill="none" {...common} />
          <Circle cx="6" cy="22" r="2" fill={colors.gold} />
        </> : null}
        {kind === "stability" ? <>
          <Path d="M14 3.5c2.2 2 5.4 3 8.5 3.3v7.1c0 5.2-3.4 8.7-8.5 10.6-5.1-1.9-8.5-5.4-8.5-10.6V6.8C8.6 6.5 11.8 5.5 14 3.5Z" fill="none" {...common} />
          <Line x1="14" y1="7" x2="14" y2="21" {...common} />
          <Path d="m10.5 11 3.5 3 3.5-3" fill="none" {...common} />
        </> : null}
        {kind === "range" ? <>
          <Path d="M7 21 21 7M13 7h8v8M15 21H7v-8" fill="none" {...common} />
        </> : null}
        {kind === "control" ? <>
          <Path d="M7 8h14M9 5 6 8l3 3M19 17l3 3-3 3M7 20h15" fill="none" {...common} />
          <Circle cx="14" cy="14" r="3" fill="none" {...common} />
        </> : null}
        {kind === "consistency" ? <>
          <Path d="M8 8a8 8 0 0 1 12.5 2M20 6v4h-4M20 20A8 8 0 0 1 7.5 18M8 22v-4h4" fill="none" {...common} />
        </> : null}
        {kind === "movement" ? <>
          <Circle cx="14" cy="6" r="2.5" fill="none" {...common} />
          <Path d="m14 9-3 6 4 2 2 7M11 15l-5 7M13 11l6 3 3-2" fill="none" {...common} />
        </> : null}
      </Svg>
    </View>
  );
}

function OverallScore({ score }: { score: number }) {
  const rounded = Math.round(score);
  const ringSize = 210;
  const strokeWidth = 13;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  return (
    <View style={{ alignItems: "center", gap: spacing.md }}>
      <View testID="overall-score-ring" style={{ width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}>
        <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} style={{ position: "absolute" }}>
          <Circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke={colors.goldSoft} strokeWidth={strokeWidth} />
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={colors.gold}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - progress / 100)}
            transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
          />
        </Svg>
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Text accessibilityLabel={`Overall score ${rounded} out of 100`} selectable testID="overall-analysis-score" style={{ color: colors.gold, fontSize: 62, lineHeight: 68, fontWeight: "800", letterSpacing: -2, fontVariant: ["tabular-nums"] }}>{rounded}</Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 22, lineHeight: 27, fontWeight: "600", fontVariant: ["tabular-nums"] }}>/100</Text>
        </View>
      </View>
      <View style={{ alignItems: "center", gap: spacing.sm }}>
        <Text selectable style={{ color: colors.gold, fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 2.2 }}>FORM GRADE</Text>
        <View accessibilityLabel={`Letter grade ${scoreLetterGrade(score)}`} testID="score-grade-stamp" style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 28, borderWidth: 2, borderColor: colors.gold }}>
          <Text selectable style={{ color: colors.gold, fontSize: 29, lineHeight: 34, fontWeight: "800" }}>{scoreLetterGrade(score)}</Text>
        </View>
      </View>
    </View>
  );
}

function ScoreRow({ score, last }: { score: MovementScore; last: boolean }) {
  const rounded = Math.round(score.score);
  return (
    <View testID={`movement-score-row-${score.id}`} style={{ gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <ScoreIcon score={score} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text selectable style={{ color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: "700" }}>{score.label}</Text>
          <Text selectable style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{score.observed}</Text>
        </View>
        <View style={{ minWidth: 49, alignItems: "flex-end" }}>
          <Text selectable style={{ color: colors.gold, fontSize: 27, lineHeight: 31, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{rounded}</Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 17, fontWeight: "600", fontVariant: ["tabular-nums"] }}>/100</Text>
        </View>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: rounded }} style={{ height: 7, overflow: "hidden", borderRadius: 4, backgroundColor: colors.border }}>
        <View style={{ width: `${Math.max(0, Math.min(100, score.score))}%`, height: 7, borderRadius: 4, backgroundColor: colors.gold }} />
      </View>
    </View>
  );
}

export function MovementScoreCard({ score, movementScores }: { score: number | null; movementScores: MovementScore[] }) {
  const { width } = useWindowDimensions();
  const splitLayout = width >= 760;
  if (score === null && movementScores.length === 0) return null;

  return (
    <View testID="movement-scores-section" style={{ width: "100%", gap: spacing.xs, padding: splitLayout ? spacing.xxl : spacing.lg, borderRadius: 24, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <Text selectable style={{ color: colors.text, fontSize: 21, lineHeight: 27, fontWeight: "800", letterSpacing: 1.2 }}>MOVEMENT SCORE</Text>
      <Text selectable style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 22 }}>Overall Performance</Text>
      <View style={{ flexDirection: splitLayout ? "row" : "column", alignItems: splitLayout ? "stretch" : "center", gap: splitLayout ? spacing.xxl : spacing.xl, paddingTop: spacing.xl }}>
        {score !== null ? <View testID="movement-score-overall" style={{ width: splitLayout ? 260 : "100%", alignItems: "center", justifyContent: "center", paddingBottom: splitLayout ? 0 : spacing.sm }}><OverallScore score={score} /></View> : null}
        {score !== null && movementScores.length > 0 ? <View style={{ width: splitLayout ? 1 : "100%", height: splitLayout ? "auto" : 1, backgroundColor: colors.border }} /> : null}
        {movementScores.length > 0 ? <View style={{ flex: splitLayout ? 1 : undefined, width: splitLayout ? undefined : "100%", minWidth: 0 }}>
          <Text selectable style={[typography.caption, { color: colors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: "700", letterSpacing: 2 }]}>SCORE BREAKDOWN</Text>
          <View testID="movement-score-list">
            {movementScores.map((item, index) => <ScoreRow key={item.id} score={item} last={index === movementScores.length - 1} />)}
          </View>
        </View> : null}
      </View>
    </View>
  );
}
