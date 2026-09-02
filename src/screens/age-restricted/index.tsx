import { useState } from "react";
import { Modal, Text, TextInput, View } from "react-native";

import { FormButton } from "@/components/form-button";
import { ResponsiveScreen } from "@/components/responsive-screen";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type AgeRestrictedScreenProps = {
  onManageSubscription: () => void;
  onContactSupport: () => void;
  onLogOut: () => Promise<void> | void;
  onDeleteAccount: () => Promise<void>;
};

export function AgeRestrictedScreen({
  onManageSubscription,
  onContactSupport,
  onLogOut,
  onDeleteAccount,
}: AgeRestrictedScreenProps) {
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<"logout" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async () => {
    if (confirmation !== "DELETE" || busy) return;
    setBusy("delete");
    setError(null);
    try {
      await onDeleteAccount();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your account could not be deleted. Try again.");
      setBusy(null);
    }
  };

  return (
    <>
      <ResponsiveScreen contentContainerStyle={{ flexGrow: 1, justifyContent: "center", gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>Formie is for adults</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>You must be 18 or older to use Formie. Analysis and purchase access are unavailable for this account.</Text>
        </View>
        <View style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>You can still manage Apple billing, contact support, log out, or permanently delete your account.</Text>
          <FormButton label="Manage Apple subscription" variant="secondary" onPress={onManageSubscription} />
          <FormButton label="Contact Formie support" variant="secondary" onPress={onContactSupport} />
          <FormButton
            label={busy === "logout" ? "Logging out…" : "Log out"}
            disabled={Boolean(busy)}
            variant="ghost"
            onPress={() => {
              setBusy("logout");
              void Promise.resolve(onLogOut()).catch(() => {
                setError("Could not log out. Try again.");
                setBusy(null);
              });
            }}
          />
          <FormButton label="Delete account" disabled={Boolean(busy)} variant="ghost" onPress={() => { setConfirmation(""); setError(null); setDeleteVisible(true); }} />
          {error && !deleteVisible ? <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
        </View>
      </ResponsiveScreen>

      <Modal animationType="fade" onRequestClose={() => { if (!busy) setDeleteVisible(false); }} transparent visible={deleteVisible}>
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: "rgba(0,0,0,0.78)" }}>
          <View style={{ gap: spacing.lg, padding: spacing.xl, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
            <View style={{ gap: spacing.sm }}>
              <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>Delete Formie account?</Text>
              <Text style={[typography.body, { color: colors.textSecondary }]}>This permanently deletes your Formie account. Apple billing remains active until you cancel it with Apple.</Text>
            </View>
            <TextInput
              accessibilityLabel="Type DELETE to confirm"
              autoCapitalize="characters"
              editable={!busy}
              onChangeText={setConfirmation}
              placeholder="Type DELETE"
              placeholderTextColor={colors.textMuted}
              style={[typography.body, { minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              value={confirmation}
            />
            {error ? <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
            <FormButton label="Confirm account deletion" disabled={confirmation !== "DELETE" || Boolean(busy)} onPress={() => { void deleteAccount(); }} />
            <FormButton label="Keep account" disabled={Boolean(busy)} variant="ghost" onPress={() => setDeleteVisible(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
