import { use } from "react";
import { useWindowDimensions } from "react-native";
import { type EdgeInsets, SafeAreaInsetsContext } from "react-native-safe-area-context";

export type PhoneSizeClass = "compact" | "regular" | "large";

export type PhoneLayoutProfile = {
  width: number;
  height: number;
  fontScale: number;
  insets: EdgeInsets;
  availableHeight: number;
  size: PhoneSizeClass;
  compact: boolean;
  large: boolean;
  short: boolean;
  stackControls: boolean;
  horizontalPadding: number;
  bottomPadding: number;
  contentMaxWidth: number;
  contentWidth: number;
  artworkMaxWidth: number;
  artworkMaxHeight: number;
  touchTarget: number;
};

type PhoneLayoutInput = {
  width: number;
  height: number;
  fontScale: number;
  insets: EdgeInsets;
};

const CONTENT_MAX_WIDTH = 560;
const MIN_TOUCH_TARGET = 44;
const ZERO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function getPhoneLayoutProfile({ width, height, fontScale, insets }: PhoneLayoutInput): PhoneLayoutProfile {
  const size: PhoneSizeClass = width <= 360 ? "compact" : width >= 430 ? "large" : "regular";
  const horizontalPadding = size === "compact" ? 12 : size === "large" ? 24 : 16;
  const availableHeight = Math.max(0, height - insets.top - insets.bottom);
  const contentWidth = Math.max(0, Math.min(CONTENT_MAX_WIDTH, width - horizontalPadding * 2 - insets.left - insets.right));

  return {
    width,
    height,
    fontScale,
    insets,
    availableHeight,
    size,
    compact: size === "compact",
    large: size === "large",
    short: availableHeight <= 700,
    stackControls: size === "compact" || fontScale >= 1.3,
    horizontalPadding,
    bottomPadding: Math.max(24, insets.bottom + 16),
    contentMaxWidth: CONTENT_MAX_WIDTH,
    contentWidth,
    artworkMaxWidth: contentWidth,
    artworkMaxHeight: Math.round(Math.max(180, Math.min(420, availableHeight * 0.42))),
    touchTarget: MIN_TOUCH_TARGET,
  };
}

export function usePhoneLayoutProfile(): PhoneLayoutProfile {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = use(SafeAreaInsetsContext) ?? ZERO_INSETS;
  return getPhoneLayoutProfile({ width, height, fontScale, insets });
}
