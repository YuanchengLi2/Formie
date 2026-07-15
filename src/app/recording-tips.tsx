import { useRouter } from "expo-router";

import { RecordingTipsScreen } from "@/screens/recording-tips";

export default function RecordingTipsRoute() {
  const router = useRouter();
  return (
    <RecordingTipsScreen
      onContinue={() => router.push("/camera")}
      onOpenSpaceHelp={() => router.push("/no-phone-space")}
    />
  );
}
