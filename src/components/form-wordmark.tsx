import { Image } from "expo-image";

export function FormWordmark({ size = 44 }: { size?: number }) {
  return (
    <Image
      accessibilityLabel="Formie logo"
      contentFit="contain"
      source={require("../../assets/images/form-logo-mark.png")}
      style={{ width: size, height: size }}
    />
  );
}
