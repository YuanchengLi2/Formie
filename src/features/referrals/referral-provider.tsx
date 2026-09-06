import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { claimReferral, isPermanentReferralError, previewCreatorCode, type PendingReferral, type ReferralMethod } from "./api";
import { clearPendingReferral, loadPendingReferral, savePendingReferral } from "./referral-store";

type ReferralContextValue = {
  pending: PendingReferral | null;
  method: ReferralMethod;
  loading: boolean;
  validating: boolean;
  validationError: string | null;
  validateCode: (code: string) => Promise<boolean>;
  claimPending: () => Promise<boolean>;
  clear: () => Promise<void>;
};
const ReferralContext = createContext<ReferralContextValue | null>(null);

export function ReferralProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const [pending, setPending] = useState<PendingReferral | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const method: ReferralMethod = "creator_code";
  const ownerRef = useRef<string | null>(null);
  const previousUserRef = useRef(auth.user?.id ?? null);
  const authenticatedUserRef = useRef(auth.user?.id ?? null);
  authenticatedUserRef.current = auth.user?.id ?? null;

  const clear = useCallback(async () => { ownerRef.current = null; setPending(null); setValidationError(null); await clearPendingReferral(); }, []);

  useEffect(() => {
    if (auth.phase === "initializing") return;
    let active = true;
    void loadPendingReferral().then((stored) => {
      if (!active) return;
      if (stored?.ownerUserId && stored.ownerUserId !== authenticatedUserRef.current) { void clear(); return; }
      if (stored) { setPending(stored.referral); ownerRef.current = stored.ownerUserId; }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.phase, clear]);

  const validateCode = useCallback(async (code: string) => {
    if (pending) return true;
    if (authenticatedUserRef.current) {
      setValidationError("Creator codes can only be added while creating a new account.");
      return false;
    }
    setValidating(true);
    setValidationError(null);
    try {
      const referral = await previewCreatorCode(code);
      setPending(referral);
      ownerRef.current = null;
      await savePendingReferral({ referral, method, ownerUserId: null });
      return true;
    } catch (error) {
      await clearPendingReferral();
      setPending(null);
      setValidationError(error instanceof Error && error.message !== "REFERRAL_UNAVAILABLE" ? error.message : "That creator code is invalid or unavailable.");
      return false;
    } finally {
      setValidating(false);
    }
  }, [method, pending]);

  useEffect(() => {
    const nextUser = auth.user?.id ?? null;
    const previousUser = previousUserRef.current;
    previousUserRef.current = nextUser;
    if (previousUser && !nextUser && ownerRef.current === previousUser) { void clear(); return; }
    if (!pending || !nextUser) return;
    if (ownerRef.current && ownerRef.current !== nextUser) { void clear(); return; }
    if (!ownerRef.current) { ownerRef.current = nextUser; void savePendingReferral({ referral: pending, method, ownerUserId: nextUser }); }
  }, [auth.user?.id, clear, method, pending]);

  const claimPending = useCallback(async () => {
    if (!pending || !auth.user) return false;
    try { await claimReferral(pending.token, method); await clear(); return true; }
    catch (error) {
      // A rejected/expired/replayed token is terminal. Offline and provider
      // failures retain the original first link for an idempotent retry.
      if (isPermanentReferralError(error)) await clear();
      return false;
    }
  }, [auth.user, clear, method, pending]);

  const value = useMemo(() => ({ pending, method, loading, validating, validationError, validateCode, claimPending, clear }), [claimPending, clear, loading, method, pending, validateCode, validating, validationError]);
  return <ReferralContext value={value}>{children}</ReferralContext>;
}

export function useReferral(): ReferralContextValue {
  const value = use(ReferralContext);
  if (!value) throw new Error("useReferral must be used inside ReferralProvider");
  return value;
}
