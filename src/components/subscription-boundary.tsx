import { useEffect, useRef, useState } from "react";
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { resolveBillingBoundary, type BillingBoundaryInput } from "@/features/access/billing-boundary";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/type";

type SubscriptionBoundaryProps = {
  access: BillingBoundaryInput;
  onBoundary?: () => void;
  now?: () => Date;
  locale?: string;
  timeZone?: string;
  style?: StyleProp<ViewStyle>;
  countdownStyle?: StyleProp<TextStyle>;
  timestampStyle?: StyleProp<TextStyle>;
};

export function SubscriptionBoundary({ access, onBoundary, now = () => new Date(), locale, timeZone, style, countdownStyle, timestampStyle }: SubscriptionBoundaryProps) {
  const [tick, setTick] = useState(0);
  const reconciledBoundary = useRef<string | null>(null);
  const boundary = resolveBillingBoundary(access, now(), locale, timeZone);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!access.paidThrough || boundary.remainingMs !== 0 || reconciledBoundary.current === access.paidThrough) return;
    reconciledBoundary.current = access.paidThrough;
    onBoundary?.();
  }, [access.paidThrough, boundary.remainingMs, onBoundary, tick]);

  return <View style={[{ gap: 3 }, style]}>
    <Text selectable style={[typography.label, { color: colors.gold, fontVariant: ["tabular-nums"] }, countdownStyle]}>{boundary.relativeCountdown}</Text>
    <Text selectable style={[typography.caption, { color: colors.textSecondary }, timestampStyle]}>{boundary.exactTimestamp}</Text>
  </View>;
}
