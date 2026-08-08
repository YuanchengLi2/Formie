import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  cancellationReasons,
  openSubscriptionIntent,
  transitionSubscriptionIntent,
  type CancellationReason,
  type SubscriptionIntentAction,
  type SubscriptionIntentState,
} from "@/features/billing/subscription-intent";

export function SubscriptionIntentModal({
  visible,
  action,
  onClose,
  onExecute,
}: {
  visible: boolean;
  action: SubscriptionIntentAction;
  onClose: () => void;
  onExecute: (reason?: CancellationReason) => Promise<void>;
}) {
  const [state, setState] = useState<SubscriptionIntentState>(() => openSubscriptionIntent(action === "resume" ? "active_cancelled" : "active_renewing"));

  useEffect(() => {
    if (visible) setState(openSubscriptionIntent(action === "resume" ? "active_cancelled" : "active_renewing"));
  }, [action, visible]);

  const move = (event: Parameters<typeof transitionSubscriptionIntent>[1]) => {
    setState((current) => transitionSubscriptionIntent(current, event) ?? current);
  };

  const execute = async () => {
    const next = transitionSubscriptionIntent(state, { type: "confirm" });
    if (!next || next === state || next.stage !== "executing") {
      if (next && next !== state) setState(next);
      return;
    }
    setState(next);
    try {
      await onExecute(next.reason);
      onClose();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "The subscription change could not be completed.";
      setState(transitionSubscriptionIntent(next, { type: "fail", message }) ?? next);
    }
  };

  const title = state.stage === "choose_reason"
    ? "Why are you cancelling?"
    : state.action === "cancel"
      ? "Are you sure you want to cancel your subscription?"
      : "Are you sure you want to resubscribe?";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.eyebrow}>SUBSCRIPTION</Text>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {state.stage === "choose_reason" ? (
              <>
                <Text style={styles.detail}>Your feedback helps us improve Formie. You can keep your current access until the paid period ends.</Text>
                <View style={styles.reasonList}>
                  {cancellationReasons.map((reason) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: state.reason === reason.value }}
                      key={reason.value}
                      onPress={() => move({ type: "select_reason", reason: reason.value })}
                      style={({ pressed }) => [styles.reasonButton, state.reason === reason.value && styles.reasonButtonSelected, pressed && styles.pressed]}
                    >
                      <Text style={[styles.reasonText, state.reason === reason.value && styles.reasonTextSelected]}>{reason.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" onPress={() => setState({ action: "cancel", stage: "confirm_cancel" })} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                    <Text style={styles.secondaryText}>Back</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={!state.reason} onPress={() => void execute()} style={({ pressed }) => [styles.primaryButton, !state.reason && styles.disabled, pressed && styles.pressed]}>
                    <Text style={styles.primaryText}>Continue</Text>
                  </Pressable>
                </View>
              </>
            ) : state.stage === "error" ? (
              <>
                <Text style={styles.detail}>We could not update your subscription yet. Your current access is unchanged.</Text>
                <Text accessibilityRole="alert" style={styles.error}>{state.error}</Text>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                    <Text style={styles.secondaryText}>Close</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => move({ type: "retry" })} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <Text style={styles.primaryText}>Try again</Text>
                  </Pressable>
                </View>
              </>
            ) : state.stage === "executing" ? (
              <View style={styles.loading}>
                <ActivityIndicator color="#E5AD32" />
                <Text style={styles.detail}>Updating your subscription...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.detail}>
                  {state.action === "cancel"
                    ? "You will keep Formie Pro and your current analysis balance until the end of your paid period. Cancellation will stop the next renewal."
                    : "Your current paid period and analysis balance will stay the same. Resubscribing enables renewal after this paid period ends."}
                </Text>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                    <Text style={styles.secondaryText}>{state.action === "cancel" ? "No, keep subscription" : "Not now"}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => void execute()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <Text style={styles.primaryText}>{state.action === "cancel" ? "Yes, cancel subscription" : "Yes, resubscribe"}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", padding: 16, backgroundColor: "rgba(0, 0, 0, 0.82)" },
  card: { maxHeight: "92%", borderWidth: 1, borderColor: "#6B5018", borderRadius: 24, backgroundColor: "#0B0B0A", overflow: "hidden" },
  content: { gap: 16, padding: 24 },
  eyebrow: { color: "#E5AD32", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#F6F2E8", fontSize: 25, fontWeight: "800", lineHeight: 31 },
  detail: { color: "#B7B1A5", fontSize: 15, lineHeight: 22 },
  reasonList: { gap: 10 },
  reasonButton: { minHeight: 56, justifyContent: "center", paddingHorizontal: 16, borderWidth: 1, borderColor: "#3D392F", borderRadius: 12, backgroundColor: "#121210" },
  reasonButtonSelected: { borderColor: "#E5AD32", backgroundColor: "#2A210D" },
  reasonText: { color: "#F0ECE2", fontSize: 15, fontWeight: "600" },
  reasonTextSelected: { color: "#E5AD32" },
  actions: { gap: 10 },
  primaryButton: { minHeight: 56, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#E5AD32" },
  primaryText: { color: "#0B0B0A", fontSize: 15, fontWeight: "800", textAlign: "center" },
  secondaryButton: { minHeight: 56, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderWidth: 1, borderColor: "#5A481D", borderRadius: 12, backgroundColor: "transparent" },
  secondaryText: { color: "#E5AD32", fontSize: 15, fontWeight: "700", textAlign: "center" },
  error: { color: "#F0A29A", fontSize: 14, lineHeight: 20 },
  loading: { minHeight: 110, alignItems: "center", justifyContent: "center", gap: 14 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
