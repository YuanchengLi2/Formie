import { Modal, Text, View } from "react-native";

import { FormButton } from "@/components/form-button";
import { AI_PROCESSING_NOTICE } from "@/features/privacy/ai-consent";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type AiProcessingConsentModalProps = {
  visible: boolean;
  agreeing?: boolean;
  error?: string | null;
  onAgree: () => void;
  onDismiss: () => void;
};

export function AiProcessingConsentModal({
  visible,
  agreeing = false,
  error = null,
  onAgree,
  onDismiss,
}: AiProcessingConsentModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={agreeing ? undefined : onDismiss}
      transparent
      visible={visible}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: "rgba(0,0,0,0.76)" }}>
        <View style={{ gap: spacing.lg, padding: spacing.xl, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
          <View style={{ gap: spacing.sm }}>
            <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>Review AI processing</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{AI_PROCESSING_NOTICE}</Text>
          </View>
          {error ? <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
          <View style={{ gap: spacing.sm }}>
            <FormButton label={agreeing ? "Saving consent…" : "Agree and analyze"} disabled={agreeing} onPress={onAgree} />
            <FormButton label="Not now" disabled={agreeing} variant="ghost" onPress={onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
