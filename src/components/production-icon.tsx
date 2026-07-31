import { Image, type ImageSource } from "expo-image";
import type { ColorValue } from "react-native";

import { colors } from "@/theme/colors";

const sources = {
  tabHome: require("../../assets/production/icons/tab-home-clean.png"),
  tabProgress: require("../../assets/production/icons/tab-progress-clean.png"),
  tabProfile: require("../../assets/production/icons/tab-profile-clean.png"),
  setupZoom: require("../../assets/production/icons/setup-zoom.png"),
  setupBag: require("../../assets/production/icons/setup-bag.png"),
  setupPerson: require("../../assets/production/icons/setup-person.png"),
  info: require("../../assets/production/icons/info.png"),
  warning: require("../../assets/production/icons/warning.png"),
  stageCheck: require("../../assets/production/icons/stage-check.png"),
  stageVideo: require("../../assets/production/icons/stage-video.png"),
  privacyLock: require("../../assets/production/icons/privacy-lock.png"),
  videoStorage: require("../../assets/production/icons/video-storage.png"),
  trash: require("../../assets/production/icons/trash.png"),
  completeVideo: require("../../assets/production/icons/complete-video.png"),
  angleCoaching: require("../../assets/production/icons/angle-coaching.png"),
} satisfies Record<string, ImageSource>;

export type ProductionIconName = keyof typeof sources;

export function ProductionIcon({ name, label, size = 28, tintColor = colors.textSecondary }: { name: ProductionIconName; label: string; size?: number; tintColor?: ColorValue }) {
  return <Image accessibilityLabel={label} contentFit="contain" source={sources[name]} style={{ width: size, height: size }} tintColor={tintColor as string} />;
}
