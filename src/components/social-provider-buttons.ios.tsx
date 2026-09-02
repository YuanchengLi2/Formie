import * as AppleAuthentication from "expo-apple-authentication";
import { StyleSheet, Text, View } from "react-native";

export function SocialProviderButtons({
  onApple,
  busy = false,
  disabled = false,
  error = null,
}: {
  onApple: () => void;
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  const unavailable = busy || disabled;
  return (
    <View testID="social-provider-buttons" style={styles.actions}>
      <View
        testID="provider-apple-wrapper"
        accessibilityState={{ disabled: unavailable }}
        pointerEvents={unavailable ? "none" : "auto"}
        style={unavailable ? styles.unavailable : undefined}
      >
        <AppleAuthentication.AppleAuthenticationButton
          testID="provider-apple"
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          cornerRadius={29}
          onPress={onApple}
          style={styles.appleButton}
        />
      </View>
      {busy ? <Text accessibilityLiveRegion="polite" style={styles.status}>Connecting to Apple…</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 22 },
  appleButton: { width: "100%", height: 58 },
  unavailable: { opacity: 0.55 },
  status: { color: "#D8D3C8", fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  error: { color: "#FF8A82", fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
});
