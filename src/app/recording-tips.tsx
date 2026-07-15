import { useLocalSearchParams, useRouter } from "expo-router";

import { RecordingTipsScreen } from "@/screens/recording-tips";

export default function RecordingTipsRoute() {
  const router = useRouter();
  const { previousSessionId } = useLocalSearchParams<{ previousSessionId?: string }>();
  return (
    <RecordingTipsScreen
      onContinue={() =>
        router.push({
          pathname: "/camera",
          params: previousSessionId ? { previousSessionId } : {},
        })
      }
      onOpenSpaceHelp={() => router.push("/no-phone-space")}
    />
  );
}
