import * as SecureStore from "expo-secure-store";

export type PendingVerification = {
  email: string;
  type: "signup" | "email_change" | "recovery";
};

const KEY = "form.auth.pending-verification.v1";
let serverValue: string | null = null;

async function getItem(): Promise<string | null> {
  if (process.env.EXPO_OS !== "web") return SecureStore.getItemAsync(KEY);
  if (typeof localStorage === "undefined") return serverValue;
  return localStorage.getItem(KEY);
}

async function setItem(value: string): Promise<void> {
  if (process.env.EXPO_OS !== "web") {
    await SecureStore.setItemAsync(KEY, value);
    return;
  }
  if (typeof localStorage === "undefined") serverValue = value;
  else localStorage.setItem(KEY, value);
}

async function deleteItem(): Promise<void> {
  if (process.env.EXPO_OS !== "web") {
    await SecureStore.deleteItemAsync(KEY);
    return;
  }
  if (typeof localStorage === "undefined") serverValue = null;
  else localStorage.removeItem(KEY);
}

export async function savePendingVerification(value: PendingVerification): Promise<void> {
  await setItem(JSON.stringify({ email: value.email.trim().toLowerCase(), type: value.type }));
}

export async function loadPendingVerification(): Promise<PendingVerification | null> {
  const stored = await getItem();
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as Partial<PendingVerification>;
    if (
      typeof value.email !== "string"
      || !value.email
      || (value.type !== "signup" && value.type !== "email_change" && value.type !== "recovery")
    ) throw new Error("Invalid pending verification");
    return { email: value.email, type: value.type };
  } catch {
    await deleteItem();
    return null;
  }
}

export async function clearPendingVerification(): Promise<void> {
  await deleteItem();
}
