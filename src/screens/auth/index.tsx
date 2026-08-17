import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";

import { AccountAccessScreen } from "@/components/account-access-screen";
import type { SocialProvider } from "@/features/auth/auth-service";
import { onboardingTheme as theme } from "@/theme/onboarding";

export function AuthLoadingScreen({ message = "Loading Formie…" }: { message?: string }) {
  return <View style={styles.loading}><StatusBar hidden /><ActivityIndicator color={theme.colors.gold} /><Text style={styles.detail}>{message}</Text></View>;
}

export function SocialLoginScreen({ onOAuth, onCreateAccount, onBack, onOpenTerms, onOpenPrivacy, busyProvider, error, notice }: {
  onOAuth: (provider: "apple") => void;
  onCreateAccount: () => void;
  onBack?: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
  busyProvider: SocialProvider | null;
  error?: string | null;
  notice?: string | null;
}) {
  return <AccountAccessScreen mode="login" onOAuth={onOAuth} onCreateAccount={onCreateAccount} onBack={onBack} onOpenTerms={onOpenTerms} onOpenPrivacy={onOpenPrivacy} busyProvider={busyProvider} error={error} notice={notice} />;
}

export function AccessRecoveryScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.loading}><StatusBar hidden /><Text accessibilityRole="alert" style={styles.detail}>{message}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry access check" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: theme.colors.background },
  detail: { maxWidth: 320, color: theme.colors.textMuted, fontSize: 17, lineHeight: 25, textAlign: "center" },
  retry: { minWidth: 160, minHeight: 54, borderRadius: 14, backgroundColor: theme.colors.gold, alignItems: "center", justifyContent: "center" },
  retryText: { color: "#070707", fontSize: 17, fontWeight: "800" },
});
