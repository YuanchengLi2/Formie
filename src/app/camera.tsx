import { useLocalSearchParams } from "expo-router";

import { CameraScreen } from "@/screens/camera";

export default function CameraRoute() {
  const { previousSessionId } = useLocalSearchParams<{ previousSessionId?: string }>();
  return <CameraScreen previousSessionId={previousSessionId} />;
}
