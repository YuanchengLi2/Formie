import { HomeScreen } from "@/screens/home";
import { useRouter } from "expo-router";

export default function HomeRoute() {
  const router = useRouter();
  return (
    <HomeScreen
      onOpenSearch={() => router.push("/exercises")}
      onSelectExercise={(slug) => router.push({ pathname: "/exercises/[slug]", params: { slug } })}
    />
  );
}
