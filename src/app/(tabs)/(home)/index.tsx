import { HomeScreen } from "@/screens/home";
import { useRouter } from "expo-router";

export default function HomeRoute() {
  const router = useRouter();
  return <HomeScreen onRecord={() => router.push("/recording-tips")} />;
}
