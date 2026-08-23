import { StyleSheet, Text } from "react-native";

import { ResponsiveScreen } from "@/components/responsive-screen";
import { AccountAccessScreen } from "@/components/account-access-screen";
import { AnalysisProgressScreen } from "@/screens/analysis-progress";
import { EmailEntryScreen } from "@/screens/auth/email-auth-screens";
import { FeedbackScreen } from "@/screens/feedback";
import { ExerciseGuideScreen } from "@/screens/exercise-guide";
import { HomeScreen } from "@/screens/home";
import { ProgressScreen } from "@/screens/progress";
import { ProfileScreen } from "@/screens/profile";
import { RecordingPreflightScreen } from "@/screens/recording-preflight";
import { RecordingTipsScreen } from "@/screens/recording-tips";
import { NoPhoneSpaceScreen } from "@/screens/recording-tips/no-phone-space";
import { renderAtPhoneSize } from "@/test/render-at-phone-size";

const PHONE_PROFILES = [
  { width: 320, height: 568, horizontalPadding: 12, bottomInset: 0, bottomPadding: 24 },
  { width: 360, height: 780, horizontalPadding: 12, bottomInset: 24, bottomPadding: 40 },
  { width: 390, height: 844, horizontalPadding: 16, bottomInset: 34, bottomPadding: 50 },
  { width: 430, height: 932, horizontalPadding: 24, bottomInset: 34, bottomPadding: 50 },
  { width: 480, height: 1040, horizontalPadding: 24, bottomInset: 34, bottomPadding: 50 },
] as const;
const FONT_SCALES = [1, 1.3, 1.6] as const;
const PHONE_MATRIX = PHONE_PROFILES.flatMap((profile) => FONT_SCALES.map((fontScale) => ({ ...profile, fontScale })));

const SCREEN_CASES = [
  ["home", <HomeScreen key="home" recentAnalyses={[]} />, "home-responsive-screen"],
  ["progress", <ProgressScreen key="progress" groups={[]} onOpenSession={() => undefined} />, "progress-responsive-screen"],
  ["recording tips", <RecordingTipsScreen key="recording-tips" onContinue={() => undefined} onOpenSpaceHelp={() => undefined} />, "recording-tips-responsive-screen"],
  ["phone placement help", <NoPhoneSpaceScreen key="phone-placement" onDone={() => undefined} />, "no-phone-space-responsive-screen"],
  ["recording preflight", <RecordingPreflightScreen key="recording-preflight" mode="checking" onBack={() => undefined} />, "recording-preflight-responsive-screen"],
  ["analysis progress", <AnalysisProgressScreen key="analysis-progress" mode="upload" stage="uploading" failureMessage={null} />, "analysis-progress-responsive-screen"],
  ["feedback", <FeedbackScreen key="feedback" onSubmit={async () => ({ submitted: true, requestId: "request-1" })} />, "feedback-responsive-screen"],
  ["account access", <AccountAccessScreen key="account-access" onOAuth={() => undefined} />, "account-access-scroll"],
  ["email authentication", <EmailEntryScreen key="email-auth" intent="login" busy={false} error={null} onBack={() => undefined} onSubmit={() => undefined} />, "email-auth-scroll"],
  ["profile settings", <ProfileScreen key="profile" />, "profile-responsive-screen"],
  ["exercise guide", <ExerciseGuideScreen key="exercise-guide" exerciseName="Squat" guide={null} loading error={null} onBack={() => undefined} onRetry={() => undefined} onContinue={() => undefined} onOpenSpaceHelp={() => undefined} onOpenTutorial={() => undefined} />, "exercise-guide-responsive-screen"],
] as const;

describe("ResponsiveScreen phone matrix", () => {
  it.each(PHONE_MATRIX)("keeps content reachable at $width x $height and $fontScale font scale", async ({ width, height, fontScale, horizontalPadding, bottomInset, bottomPadding }) => {
    const rendered = await renderAtPhoneSize(
      <ResponsiveScreen testID="matrix-screen"><Text>Reachable content</Text></ResponsiveScreen>,
      {
        width,
        height,
        fontScale,
        insets: { top: width >= 390 ? 47 : 20, right: 0, bottom: bottomInset, left: 0 },
      },
    );

    const scroll = rendered.getByTestId("matrix-screen");
    const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
    expect(contentStyle).toMatchObject({
      alignSelf: "center",
      width: "100%",
      maxWidth: 560,
      paddingHorizontal: horizontalPadding,
      paddingBottom: bottomPadding,
    });
    expect(rendered.getByText("Reachable content")).toBeTruthy();
    await rendered.restoreWindowDimensions();
  });

  it.each(SCREEN_CASES.flatMap(([name, element, testID]) => PHONE_MATRIX.map((profile) => [name, element, testID, profile] as const)))("applies shared bounds to %s at the phone matrix", async (_name, element, testID, profile) => {
    const rendered = await renderAtPhoneSize(element, {
      width: profile.width,
      height: profile.height,
      fontScale: profile.fontScale,
      insets: { top: profile.width >= 390 ? 47 : 20, right: 0, bottom: profile.bottomInset, left: 0 },
    });
    const scroll = rendered.getByTestId(testID);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
      width: "100%",
      maxWidth: 560,
      paddingHorizontal: profile.horizontalPadding,
      paddingBottom: profile.bottomPadding,
    });
    await rendered.restoreWindowDimensions();
  });
});
