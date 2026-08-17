import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,

  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import { VideoView, useVideoPlayer } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormButton } from "@/components/form-button";
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
};

function Choice({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 42,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: selected ? colors.gold : colors.border,
        backgroundColor: selected ? colors.goldSoft : colors.surface,
      }}
    >
      <Text style={[typography.label, { color: selected ? colors.gold : colors.textSecondary }]}>{label}</Text>
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
    <View style={{ height: 210, overflow: "hidden", borderRadius: radii.lg, backgroundColor: colors.cameraBlack }}>
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

  const analyze = () => {
    const numericAmount = Number(amount);
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
          gap: spacing.xl,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          paddingHorizontal: spacing.lg,
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        testID="set-declaration-scroll"
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.title, { color: colors.text }]}>Tell Formie what you did</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            You provide the set facts. Formie focuses on your technique and every visible correction.
          </Text>
        </View>

        {showVideoPreview ? <RecordedSetPreview localVideoUri={localVideoUri} /> : null}

        {isFreshRecording && showVideoPreview ? (
          <FormButton label="Re-record this set" variant="secondary" onPress={onRetake} />
        ) : null}

        {preselectedExercise ? (
          <View style={{ gap: spacing.sm }}>
            <FieldLabel>Exercise</FieldLabel>
            <View style={{
              minHeight: 58,
              paddingHorizontal: spacing.md,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}>
              <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                {preselectedExercise.canonicalName}
              </Text>
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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <Choice label="Reps" selected={amountKind === "reps"} onPress={() => setAmountKind("reps")} accessibilityLabel="Measure in reps" />
            <Choice label="Seconds" selected={amountKind === "seconds"} onPress={() => setAmountKind("seconds")} accessibilityLabel="Measure in seconds" />
          </View>
          <TextInput
            accessibilityLabel="Completed amount"
            keyboardType="number-pad"
            placeholder={amountKind === "reps" ? "How many reps?" : "How many seconds?"}
            placeholderTextColor={colors.textMuted}
            style={[typography.body, inputStyle]}
            value={amount}
            onChangeText={setAmount}
          />
          {amountKind === "reps" ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Is that count total or per side?</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                <Choice label="Total" selected={countScope === "total"} onPress={() => setCountScope("total")} accessibilityLabel="Count is total" />
                <Choice label="Per side" selected={countScope === "per_side"} onPress={() => setCountScope("per_side")} accessibilityLabel="Count is per side" />
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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <Choice label="Bodyweight" selected={loadKind === "bodyweight"} onPress={() => setLoadKind("bodyweight")} accessibilityLabel="Bodyweight load" />
            <Choice label="Known weight" selected={loadKind === "known"} onPress={() => setLoadKind("known")} accessibilityLabel="Known weight" />
            <Choice label="I’m not sure" selected={loadKind === "unknown"} onPress={() => setLoadKind("unknown")} accessibilityLabel="Unknown load" />
          </View>
          {loadKind === "known" ? (
            <View style={{ gap: spacing.sm }}>
              <TextInput
                accessibilityLabel="Load value"
                keyboardType="decimal-pad"
                placeholder="Weight"
                placeholderTextColor={colors.textMuted}
                style={[typography.body, inputStyle]}
                value={loadValue}
                onChangeText={setLoadValue}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                <Choice label="lb" selected={loadUnit === "lb"} onPress={() => setLoadUnit("lb")} accessibilityLabel="Load unit pounds" />
                <Choice label="kg" selected={loadUnit === "kg"} onPress={() => setLoadUnit("kg")} accessibilityLabel="Load unit kilograms" />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                <Choice label="Per hand" selected={loadScope === "per_hand"} onPress={() => setLoadScope("per_hand")} accessibilityLabel="Load scope per hand" />
                <Choice label="Total" selected={loadScope === "total"} onPress={() => setLoadScope("total")} accessibilityLabel="Load scope total" />
                <Choice label="Machine setting" selected={loadScope === "machine"} onPress={() => setLoadScope("machine")} accessibilityLabel="Load scope machine setting" />
              </View>
            </View>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <FieldLabel optional>Anything you want extra attention on?</FieldLabel>
          <TextInput
            accessibilityLabel="Extra attention note"
            maxLength={280}
            multiline
            placeholder="For example: my left shoulder or the bottom of each rep"
            placeholderTextColor={colors.textMuted}
            style={[typography.body, inputStyle, { minHeight: 88, paddingTop: spacing.md, textAlignVertical: "top" }]}
            value={focusNote}
            onChangeText={setFocusNote}
          />
        </View>

        {validationError || submitError ? <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>{validationError ?? submitError}</Text> : null}

        <View style={{ gap: spacing.sm }}>
          <FormButton label={submitting ? `${submitLabel}…` : submitLabel} disabled={submitting} onPress={analyze} />
          {!isFreshRecording ? <FormButton label={secondaryLabel} variant="secondary" onPress={onRetake} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
