import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { useCaptureStore } from "@/features/capture/capture-store";
import { RecordingTipsScreen } from "@/screens/recording-tips";

export default function RecordingTipsRoute() {
  const router = useRouter();
  const { previousSessionId } = useLocalSearchParams<{ previousSessionId?: string }>();
  const exerciseChoice = useCaptureStore((state) => state.exerciseChoice);

  if (exerciseChoice.kind === "unselected") {
    return <Redirect href="/exercise-selection" />;
  }

  return (
    <RecordingTipsScreen
      onContinue={() =>
        router.replace({
          pathname: "/camera",
          params: previousSessionId ? { previousSessionId } : {},
        })
      }
      onOpenSpaceHelp={() => router.push("/no-phone-space")}
    />
  );
}
