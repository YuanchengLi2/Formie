import { Redirect, type Href } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { AuthLoadingScreen } from "@/screens/auth";

export default function IndexRoute() {
  const { phase } = useAuth();
  if (phase === "initializing") return <AuthLoadingScreen />;
  if (phase === "authenticated") return <Redirect href="/(tabs)/(home)" />;
  if (phase === "verification_pending") return <Redirect href={"/verify-email" as Href} />;
  if (phase === "password_recovery") return <Redirect href={"/reset-password" as Href} />;
  return <Redirect href={"/login" as Href} />;
}
