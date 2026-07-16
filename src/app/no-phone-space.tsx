import { useRouter } from "expo-router";

import { NoPhoneSpaceScreen } from "@/screens/recording-tips/no-phone-space";

export default function NoPhoneSpaceRoute() {
  const router = useRouter();
  return <NoPhoneSpaceScreen onDone={() => router.back()} />;
}
