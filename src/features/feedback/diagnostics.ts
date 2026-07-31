import Constants from "expo-constants";
import { Platform } from "react-native";

import type { FeedbackDiagnostics } from "./api";

export function getFeedbackDiagnostics(): FeedbackDiagnostics {
  return {
    appVersion: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "unknown",
    build: Constants.nativeBuildVersion ?? "development",
    platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web",
    osVersion: String(Platform.Version ?? "unknown"),
  };
}
