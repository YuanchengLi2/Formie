import * as Linking from "expo-linking";
import { Image } from "expo-image";
import { useState, type PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccess } from "@/features/access/access-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { useBilling } from "@/features/billing/billing-provider";
import { useProfile } from "@/features/profile/profile-provider";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

import { FormButton } from "./form-button";

const logo = require("../../assets/images/form-logo-mark.png");

export function SubscriptionAccessGate({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const profile = useProfile();
  const access = useAccess();
  const billing = useBilling();
  const [signingOut, setSigningOut] = useState(false);
  const profileComplete = profile.profile?.onboardingCompleted === true
    && profile.profile?.onboardingVersion === "approved-v1";

  // Account access and paid analysis access are separate. Once verification
  // resolves, completed accounts remain usable even when the paid period ended.
  if (auth.phase !== "authenticated" || !profileComplete || access.access.status !== "unknown") {
    return children;
  }

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await billing.logOut().catch(() => undefined);
    await auth.logOut("user");
  };

  const verifying = access.status === "loading";
  return <View style={[styles.screen, { paddingTop: Math.max(insets.top, spacing.lg), paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
    <Image accessibilityLabel="Formie" source={logo} contentFit="contain" style={styles.logo} />
    {verifying ? <>
      <ActivityIndicator color={colors.gold} size="large" />
      <Text selectable style={[typography.title, styles.title]}>Checking your subscription</Text>
      <Text selectable style={[typography.body, styles.detail]}>Your account is still signed in while Formie verifies the current billing period.</Text>
    </> : <>
      <Text selectable style={[typography.title, styles.title]}>We couldn’t verify your subscription</Text>
      <Text selectable style={[typography.body, styles.detail]}>Your account remains protected. Retry the check, contact support, or sign out.</Text>
      <View style={styles.actions}>
        <FormButton label="Retry access check" disabled={signingOut} onPress={() => void access.refresh().catch(() => undefined)} />
        <Pressable accessibilityRole="button" accessibilityLabel="Contact support" onPress={() => void Linking.openURL("mailto:support@useformie.com")} style={styles.secondary}><Text style={styles.secondaryText}>Contact support</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={signingOut} onPress={() => void signOut()} style={styles.secondary}><Text style={styles.secondaryText}>{signingOut ? "Signing out…" : "Sign out"}</Text></Pressable>
      </View>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg, paddingHorizontal: spacing.xl, backgroundColor: colors.background },
  logo: { width: 92, height: 92 },
  title: { maxWidth: 440, color: colors.text, textAlign: "center" },
  detail: { maxWidth: 440, color: colors.textSecondary, textAlign: "center" },
  actions: { width: "100%", maxWidth: 420, gap: spacing.md },
  secondary: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: radii.md, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface },
  secondaryText: { ...typography.label, color: colors.gold },
});
