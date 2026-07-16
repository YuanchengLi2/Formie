import { ScrollView, Text, View } from "react-native";

import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { ProductionIcon, type ProductionIconName } from "@/components/production-icon";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

function InfoRow({ icon, title, detail }: { icon: ProductionIconName; title: string; detail: string }) {
  return <View style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}><View style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border }}><ProductionIcon name={icon} label={title} size={23} tintColor={colors.textSecondary} /></View><View style={{ flex: 1, gap: 2 }}><Text selectable style={[typography.label, { color: colors.text }]}>{title}</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>{detail}</Text></View></View>;
}

export function ProfileScreen() {
  return <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xl }}>
    <FormWordmark /><Text selectable style={[typography.title, { color: colors.text }]}>Profile</Text>
    <FormCard style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceRaised }}><View style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, borderWidth: 1, borderColor: colors.gold }}><Text selectable style={{ color: colors.gold, fontSize: 20 }}>F</Text></View><View style={{ flex: 1, gap: 2 }}><Text selectable style={[typography.heading, { color: colors.text }]}>Private Guest</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>This device</Text></View></FormCard>
    <View><Text selectable style={[typography.caption, { marginBottom: spacing.sm, color: colors.textMuted, letterSpacing: 0.8 }]}>PRIVACY</Text><InfoRow icon="privacyLock" title="Private by default" detail="Only you can access your recordings" /><InfoRow icon="videoStorage" title="Video storage" detail="Original videos remain private" /></View>
    <Text selectable style={[typography.body, { color: colors.textSecondary }]}>No public profile and no manual exercise log.</Text><Text selectable style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>FORM 1.0</Text>
  </ScrollView>;
}
