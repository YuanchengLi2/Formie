import * as SecureStore from "expo-secure-store";
import type { PendingReferral } from "./api";

const KEY = "formie.pending-creator-code.v2";
const LEGACY_KEY = "formie.pending-referral.v1";
type StoredReferral = { referral: PendingReferral; method: "creator_code"; ownerUserId: string | null };

export async function loadPendingReferral(): Promise<StoredReferral | null> {
  await SecureStore.deleteItemAsync(LEGACY_KEY);
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as StoredReferral;
    if (!value.referral || Date.parse(value.referral.expiresAt) <= Date.now()) { await SecureStore.deleteItemAsync(KEY); return null; }
    return value;
  } catch { await SecureStore.deleteItemAsync(KEY); return null; }
}
export async function savePendingReferral(value: StoredReferral): Promise<void> { await SecureStore.setItemAsync(KEY, JSON.stringify(value)); }
export async function clearPendingReferral(): Promise<void> { await Promise.all([SecureStore.deleteItemAsync(KEY), SecureStore.deleteItemAsync(LEGACY_KEY)]).then(() => undefined); }
