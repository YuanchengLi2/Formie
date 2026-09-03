import { View } from "react-native";

export function SocialProviderButtons(_props: {
  onApple: () => void;
  intent?: "login" | "create_account";
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  return <View testID="social-provider-buttons" />;
}
