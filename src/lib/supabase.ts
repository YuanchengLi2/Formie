import * as SecureStore from "expo-secure-store";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";

const isTestRuntime = process.env.NODE_ENV === "test";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? (isTestRuntime ? "https://test.supabase.local" : undefined);
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? (isTestRuntime ? "test-anon-key" : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase public configuration is missing");
}

const serverMemory = new Map<string, string>();

const secureSessionStorage: SupportedStorage = {
  async getItem(key) {
    if (process.env.EXPO_OS === "web") {
      return typeof localStorage === "undefined" ? serverMemory.get(key) ?? null : localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    if (process.env.EXPO_OS === "web") {
      if (typeof localStorage === "undefined") serverMemory.set(key, value);
      else localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async removeItem(key) {
    if (process.env.EXPO_OS === "web") {
      if (typeof localStorage === "undefined") serverMemory.delete(key);
      else localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureSessionStorage,
    flowType: "pkce",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
