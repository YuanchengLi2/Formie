import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,

  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import { VideoView, useVideoPlayer } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormButton } from "@/components/form-button";
import { CaptureReferenceIcon } from "@/components/capture-reference-icon";
import { exerciseIsUnilateral } from "@/features/analysis/exercise-catalog";
import {
  setDeclarationSchema,
  type SetDeclaration,
} from "@/features/analysis/set-declaration";
import type { SelectedCaptureExercise } from "@/features/capture/types";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type SetDeclarationScreenProps = {
  localVideoUri: string;
  initialDeclaration?: SetDeclaration | null;
  preselectedExercise?: SelectedCaptureExercise | null;
  initialExerciseName?: string;
  analyzeLabel?: string;
  secondaryLabel?: string;
  submitError?: string | null;
  submitting?: boolean;
  showSide?: boolean;
  showVideoPreview?: boolean;
  onAnalyze: (declaration: SetDeclaration) => void;
  onRetake: () => void;
  onChangeExercise?: () => void;
  onBack?: () => void;
};

function Choice({
  label,
  selected,
  onPress,
  accessibilityLabel,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[{
        minHeight: 48,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: selected ? colors.gold : colors.border,
        backgroundColor: selected ? colors.gold : colors.surface,
      }, style]}
    >
      <Text style={[typography.label, { color: selected ? colors.cameraBlack : colors.textSecondary, textAlign: "center" }]}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ children, optional = false }: { children: string; optional?: boolean }) {
  return (
    <Text style={[typography.label, { color: colors.text }]}>
      {children}{optional ? " (optional)" : ""}
    </Text>
  );
}

const inputStyle = {
  minHeight: 50,
  paddingHorizontal: spacing.md,
  borderRadius: radii.md,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.surface,
  color: colors.text,
} as const;

function RecordedSetPreview({ localVideoUri }: { localVideoUri: string }) {
  const player = useVideoPlayer(localVideoUri, (created) => {
    created.loop = true;
  });

  return (
    <View style={{ overflow: "hidden", aspectRatio: 16 / 9, borderRadius: radii.lg, backgroundColor: colors.cameraBlack }}>
      <VideoView
        accessibilityLabel="Recorded set preview"
        contentFit="contain"
        nativeControls
        player={player}
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}

export function SetDeclarationScreen({
  localVideoUri,
  initialDeclaration = null,
  preselectedExercise = null,
  initialExerciseName,
  analyzeLabel,
  secondaryLabel = "Retake",
  submitError = null,
  submitting = false,
  showSide = true,
  showVideoPreview = true,
  onAnalyze,
  onRetake,
  onChangeExercise,
  onBack,
}: SetDeclarationScreenProps) {
  const isFreshRecording = secondaryLabel === "Retake";
  const submitLabel = analyzeLabel ?? (isFreshRecording ? "Submit for Analysis" : "Analyze Set");
  const insets = useSafeAreaInsets();
  const [exerciseQuery, setExerciseQuery] = useState(
    preselectedExercise?.canonicalName ?? initialExerciseName ?? initialDeclaration?.exercise.label ?? "",
  );
  const [amountKind, setAmountKind] = useState<"reps" | "seconds">(initialDeclaration?.amount.kind ?? "reps");
  const [amount, setAmount] = useState(initialDeclaration ? String(initialDeclaration.amount.value) : "");
  const [countScope, setCountScope] = useState<"total" | "per_side" | null>(
    initialDeclaration?.amount.countScope ?? null,
  );
  const [loadKind, setLoadKind] = useState<"bodyweight" | "unknown" | "known" | null>(
    initialDeclaration?.load.kind ?? null,
  );
  const [loadValue, setLoadValue] = useState(
    initialDeclaration?.load.kind === "known" ? String(initialDeclaration.load.value) : "",
  );
  const [loadUnit, setLoadUnit] = useState<"lb" | "kg">(
    initialDeclaration?.load.kind === "known" ? initialDeclaration.load.unit : "lb",
  );
  const [loadScope, setLoadScope] = useState<"per_hand" | "total" | "machine">(
    initialDeclaration?.load.kind === "known" ? initialDeclaration.load.scope : "total",
  );
  const [side, setSide] = useState<SetDeclaration["side"]>(initialDeclaration?.side ?? null);
  const [focusNote, setFocusNote] = useState(initialDeclaration?.focusNote ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  const unilateral = useMemo(
    () => exerciseIsUnilateral(
      preselectedExercise
        ? {
            id: preselectedExercise.catalogExerciseId,
            name: preselectedExercise.canonicalName,
            family: "",
            aliases: [],
            mechanics: preselectedExercise.mechanics,
          }
        : null,
      exerciseQuery,
    ),
    [exerciseQuery, preselectedExercise],
  );

  useEffect(() => {
    const nextExercise = preselectedExercise?.canonicalName ?? initialExerciseName ?? initialDeclaration?.exercise.label ?? "";
    setExerciseQuery(nextExercise);
  }, [initialDeclaration?.exercise.label, initialExerciseName, preselectedExercise?.canonicalName]);

  useEffect(() => {
    if (amountKind === "seconds") setCountScope(null);
  }, [amountKind]);

  useEffect(() => {
    if (!unilateral || !showSide) setSide(null);
  }, [showSide, unilateral]);

  const chooseLoad = (next: "bodyweight" | "unknown" | "known") => {
    setLoadKind(next);
    if (next !== "known") {
      setLoadValue("");
      setLoadUnit("lb");
      setLoadScope("total");
    }
    setValidationError(null);
  };

  const analyze = () => {
    const numericAmount = Number(amount);
    if (!exerciseQuery.trim()) {
      setValidationError("Enter the exercise you performed.");
      return;
    }
    if (!Number.isInteger(numericAmount) || numericAmount < 1) {
      setValidationError(amountKind === "reps" ? "Enter the number of reps." : "Enter the number of seconds.");
      return;
    }
    if (amountKind === "reps" && countScope === null) {
      setValidationError("Choose whether the rep count is total or per side.");
      return;
    }
    if (showSide && unilateral && side === null) {
      setValidationError("Choose which side pattern you performed.");
      return;
    }
    if (!loadKind) {
      setValidationError("Choose bodyweight, a known load, or I’m not sure.");
      return;
    }
    if (loadKind === "known" && (!Number.isFinite(Number(loadValue)) || Number(loadValue) <= 0)) {
      setValidationError("Enter the known load.");
      return;
    }

    const unchangedInitialExercise = initialDeclaration?.exercise
      && initialDeclaration.exercise.label === exerciseQuery.trim()
      ? initialDeclaration.exercise
      : null;
    const exercise = preselectedExercise
      ? {
          source: "catalog" as const,
          catalogExerciseId: preselectedExercise.catalogExerciseId,
          label: preselectedExercise.canonicalName,
        }
      : unchangedInitialExercise ?? {
          source: "custom" as const,
          catalogExerciseId: null,
          label: exerciseQuery.trim(),
        };
    const candidate = {
      exercise,
      amount: {
        kind: amountKind,
        value: numericAmount,
        countScope: amountKind === "reps" ? countScope : null,
      },
      load: loadKind === "known"
        ? { kind: "known" as const, value: Number(loadValue), unit: loadUnit, scope: loadScope }
        : { kind: loadKind },
      side: unilateral ? side : null,
      styles: [],
      focusNote: focusNote.trim() || null,
    };
    const parsed = setDeclarationSchema.safeParse(candidate);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Check the set details and try again.");
      return;
    }
    setValidationError(null);
    onAnalyze(parsed.data);
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{
          gap: 22,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        testID="set-declaration-scroll"
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          {onBack ? (
            <Pressable
              accessibilityLabel="Back from Set Details"
              accessibilityRole="button"
              onPress={onBack}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, borderWidth: 1, borderColor: "#303030", backgroundColor: "#141414" }}
            >
              <CaptureReferenceIcon name="back" size={25} color={colors.text} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Text style={[typography.title, { color: colors.text, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 }]}>Tell Formie what you did</Text>
            <Text style={[typography.body, { color: colors.textSecondary, fontSize: 15, lineHeight: 21 }]}>The more details you provide, the more accurate your analysis.</Text>
          </View>
        </View>

        {showVideoPreview ? <RecordedSetPreview localVideoUri={localVideoUri} /> : null}

        {isFreshRecording && showVideoPreview ? (
          <FormButton label="Re-record this set" variant="secondary" onPress={onRetake} />
        ) : null}

        {preselectedExercise ? (
          <View>
            <View style={{
              minHeight: 82,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}>
              <View style={{ flex: 1, gap: 4 }}><Text style={[typography.caption, { color: colors.textSecondary, fontSize: 11, lineHeight: 14, fontWeight: "700" }]}>EXERCISE</Text><Text style={[typography.body, { color: colors.text, fontSize: 16, lineHeight: 21 }]}>{preselectedExercise.canonicalName}</Text></View>
              <Pressable
                accessibilityLabel="Change exercise"
                accessibilityRole="button"
                onPress={onChangeExercise}
                style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.sm }}
              >
                <Text style={[typography.label, { color: colors.gold }]}>Change</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <FieldLabel>Exact exercise</FieldLabel>
            <TextInput
              accessibilityLabel="Exact exercise"
              autoCapitalize="words"
              maxLength={120}
              placeholder="Type the exact exercise"
              placeholderTextColor={colors.textMuted}
              style={[typography.body, inputStyle]}
              value={exerciseQuery}
              onChangeText={(value) => {
                setExerciseQuery(value);
                setValidationError(null);
              }}
            />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Choose the exercise now so Formie analyzes the correct movement.
            </Text>
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          <FieldLabel>Completed amount</FieldLabel>
          <View testID="amount-kind-options" style={{ width: "100%", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <Choice label="Reps" selected={amountKind === "reps"} onPress={() => setAmountKind("reps")} accessibilityLabel="Measure in reps" style={{ flexGrow: 1, flexBasis: 120 }} />
            <Choice label="Seconds" selected={amountKind === "seconds"} onPress={() => setAmountKind("seconds")} accessibilityLabel="Measure in seconds" style={{ flexGrow: 1, flexBasis: 120 }} />
          </View>
          <TextInput
            accessibilityLabel="Completed amount"
            keyboardType="number-pad"
            placeholder={amountKind === "reps" ? "How many reps?" : "How many seconds?"}
            placeholderTextColor={colors.textMuted}
            style={[typography.body, inputStyle]}
            value={amount}
            onChangeText={(value) => { setAmount(value); setValidationError(null); }}
          />
          {amountKind === "reps" ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.label, { color: colors.text }]}>Total count or per side?</Text>
              <View testID="count-scope-options" style={{ width: "100%", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                <Choice label="Total" selected={countScope === "total"} onPress={() => setCountScope("total")} accessibilityLabel="Count is total" style={{ flexGrow: 1, flexBasis: 120 }} />
                <Choice label="Per side" selected={countScope === "per_side"} onPress={() => setCountScope("per_side")} accessibilityLabel="Count is per side" style={{ flexGrow: 1, flexBasis: 120 }} />
              </View>
            </View>
          ) : null}
        </View>

        {showSide && unilateral ? (
          <View style={{ gap: spacing.sm }}>
            <FieldLabel>Side pattern</FieldLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {(["left", "right", "bilateral", "alternating"] as const).map((value) => (
                <Choice
                  key={value}
                  label={value[0].toUpperCase() + value.slice(1)}
                  selected={side === value}
                  onPress={() => setSide(value)}
                  accessibilityLabel={`Performed on ${value} side`}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <FieldLabel>Load</FieldLabel>
          <View testID="load-kind-options" style={{ width: "100%", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <Choice label="Bodyweight" selected={loadKind === "bodyweight"} onPress={() => chooseLoad("bodyweight")} accessibilityLabel="Bodyweight load" style={{ flexGrow: 1, flexBasis: 140 }} />
            <Choice label="Known weight" selected={loadKind === "known"} onPress={() => chooseLoad("known")} accessibilityLabel="Known weight" style={{ flexGrow: 1, flexBasis: 140 }} />
            <Choice label="I’m not sure" selected={loadKind === "unknown"} onPress={() => chooseLoad("unknown")} accessibilityLabel="Unknown load" style={{ flexGrow: 1, flexBasis: 140 }} />
          </View>
          {loadKind === "known" ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
                <TextInput
                  accessibilityLabel="Load value"
                  keyboardType="decimal-pad"
                  placeholder="Weight"
                  placeholderTextColor={colors.textMuted}
                  style={[typography.body, inputStyle, { flexGrow: 1, flexBasis: 150 }]}
                  value={loadValue}
                  onChangeText={setLoadValue}
                />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                  <Choice label="lb" selected={loadUnit === "lb"} onPress={() => setLoadUnit("lb")} accessibilityLabel="Load unit pounds" style={{ minWidth: 64 }} />
                  <Choice label="kg" selected={loadUnit === "kg"} onPress={() => setLoadUnit("kg")} accessibilityLabel="Load unit kilograms" style={{ minWidth: 64 }} />
                </View>
              </View>
              <View style={{ width: "100%", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                <Choice label="Per hand" selected={loadScope === "per_hand"} onPress={() => setLoadScope("per_hand")} accessibilityLabel="Load scope per hand" style={{ flexGrow: 1, flexBasis: 100 }} />
                <Choice label="Total" selected={loadScope === "total"} onPress={() => setLoadScope("total")} accessibilityLabel="Load scope total" style={{ flexGrow: 1, flexBasis: 100 }} />
                <Choice label="Machine setting" selected={loadScope === "machine"} onPress={() => setLoadScope("machine")} accessibilityLabel="Load scope machine setting" style={{ flexGrow: 1, flexBasis: 130 }} />
              </View>
            </View>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <FieldLabel optional>Anything you want extra attention on?</FieldLabel>
          <View>
          <TextInput
            accessibilityLabel="Extra attention note"
            maxLength={120}
            multiline
            placeholder="For example: my left shoulder or the bottom of each rep"
            placeholderTextColor={colors.textMuted}
            style={[typography.body, inputStyle, { minHeight: 112, paddingTop: spacing.md, paddingBottom: 28, textAlignVertical: "top" }]}
            value={focusNote}
            onChangeText={setFocusNote}
          />
          <Text testID="focus-note-counter" style={[typography.caption, { position: "absolute", right: 14, bottom: 10, color: colors.textMuted, fontVariant: ["tabular-nums"] }]}>{focusNote.length}/120</Text>
          </View>
        </View>

        {validationError || submitError ? <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>{validationError ?? submitError}</Text> : null}

        <View style={{ gap: spacing.sm }}>
          <FormButton label={submitting ? `${submitLabel}…` : submitLabel} disabled={submitting} onPress={analyze} style={{ minHeight: 58, borderRadius: 14 }} />
          {!isFreshRecording ? <FormButton label={secondaryLabel} variant="secondary" onPress={onRetake} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
