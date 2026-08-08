import { Alert } from "react-native";
import { Tabs, type Href, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CenterTabButton } from "@/components/center-tab-button";
import { useAccess } from "@/features/access/access-provider";
import { resolveAnalysisEntry } from "@/features/access/account-access";
import { formatQuotaMessage, formatQuotaTitle } from "@/features/access/quota-message";
import { CoachTabIcon } from "@/components/coach-tab-icon";
import { ProductionIcon } from "@/components/production-icon";
import { colors } from "@/theme/colors";

export default function TabsLayout() {
  const router = useRouter();
  const access = useAccess();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);
  const analysisEntry = resolveAnalysisEntry(access.status, access.access);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: "600", marginTop: 0 },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 74 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          overflow: "visible",
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarItemStyle: { minHeight: 64, justifyContent: "center", overflow: "visible" },
        tabBarIconStyle: { width: 28, height: 28 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="(home)" options={{ title: "Home", tabBarIcon: ({ color }) => <ProductionIcon name="tabHome" label="Home" size={26} tintColor={color} /> }} />
      <Tabs.Screen name="(coach)" options={{ title: "Coach", href: "/(tabs)/(coach)", tabBarIcon: ({ color }) => <CoachTabIcon color={color} size={26} /> }} />
      <Tabs.Screen
        name="(record)"
        options={{
          title: "Record",
          tabBarButton: () => <CenterTabButton variant={analysisEntry} label={analysisEntry === "purchase" ? "Purchase" : analysisEntry === "analysis_pending" ? "View analysis" : analysisEntry === "renewal_pending" ? "Checking" : "Record"} accessibilityLabel={analysisEntry === "purchase" ? "Purchase subscription" : analysisEntry === "quota_exhausted" ? "Record. Monthly analysis allowance used" : analysisEntry === "analysis_pending" ? "View analysis in progress" : analysisEntry === "renewal_pending" ? "Check subscription renewal" : "Record"} onPress={() => {
            if (analysisEntry === "purchase") {
              router.push("/subscription" as Href);
              return;
            }
            if (analysisEntry === "analysis_pending" && access.access.pendingAnalysisSessionId) {
              router.push(`/analysis/${access.access.pendingAnalysisSessionId}` as Href);
              return;
            }
            if (analysisEntry === "renewal_pending") {
              void access.refresh().catch(() => undefined);
              return;
            }
            if (analysisEntry === "unavailable") {
              Alert.alert("Analysis access unavailable", "Formie could not confirm your analysis balance. Check your connection and try again.", [
                { text: "Cancel", style: "cancel" },
                { text: "Try again", onPress: () => void access.refresh().catch(() => undefined) },
              ]);
              return;
            }
            if (analysisEntry === "quota_exhausted") {
              const cancelled = access.access.lifecycleState === "active_cancelled";
              Alert.alert(formatQuotaTitle(access.access.lifecycleState, access.access.paidThrough), formatQuotaMessage({
                lifecycleState: access.access.lifecycleState,
                limit: access.access.quotaLimit,
                resetsAt: access.access.quotaResetsAt,
                paidThrough: access.access.paidThrough,
              }), cancelled ? [
                { text: "Not now", style: "cancel" },
                { text: "Manage subscription", onPress: () => router.push("/subscription" as Href) },
              ] : [{ text: "OK" }]);
              return;
            }
            router.push("/exercise-selection" as Href);
          }} />,
        }}
      />
      <Tabs.Screen name="(progress)" options={{ title: "Progress", tabBarIcon: ({ color }) => <ProductionIcon name="tabProgress" label="Progress" size={26} tintColor={color} /> }} />
      <Tabs.Screen name="(profile)" options={{ title: "Settings", tabBarIcon: ({ color }) => <ProductionIcon name="tabProfile" label="Settings" size={26} tintColor={color} /> }} />
    </Tabs>
  );
}
