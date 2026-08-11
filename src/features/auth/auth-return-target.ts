import * as SecureStore from "expo-secure-store";

const RETURN_TARGET_KEY = "formie.auth-return-target";
type AuthReturnTarget = "/subscription";

export async function setAuthReturnTarget(target: AuthReturnTarget): Promise<void> {
  if (target !== "/subscription") throw new Error("Unsupported authentication return target");
  await SecureStore.setItemAsync(RETURN_TARGET_KEY, "subscription");
}

export async function consumeAuthReturnTarget(): Promise<AuthReturnTarget | null> {
  const stored = await SecureStore.getItemAsync(RETURN_TARGET_KEY);
  await SecureStore.deleteItemAsync(RETURN_TARGET_KEY);
  return stored === "subscription" ? "/subscription" : null;
}
