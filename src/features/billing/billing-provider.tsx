import { AppState } from "react-native";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { useAccess } from "@/features/access/access-provider";

import { REVENUECAT_ENTITLEMENT_ID, REVENUECAT_LAUNCH_VERSION, REVENUECAT_OFFERING_ID } from "./constants";
import { refreshEntitlement } from "./api";
import { purchasesClient } from "./purchases";
import type { BillingCustomerInfo, BillingOffering, BillingSubscription, EntitlementResolution, PurchaseState } from "./types";
import { friendlyPurchaseError } from "./billing-errors";
import { selectMonthlyPackage } from "./billing-package";
import { customerHasEntitlement } from "./purchase-access";
import { resolveEntitlement } from "./entitlement-resolution";

export type BillingContextValue = {
  state: PurchaseState;
  entitlementResolution: EntitlementResolution;
  offering: BillingOffering | null;
  priceString: string | null;
  error: string | null;
  restoreMessage: string | null;
  subscription: BillingSubscription | null;
  load: () => Promise<void>;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
  logOut: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const { refresh: refreshAccess, access: serverAccess } = useAccess();
  const accessStatus = serverAccess.status;
  const onboarding = useOnboarding();
  const onboardingStatus = onboarding.status;
  const completeAccess = onboarding.completeAccess;
  const [state, setState] = useState<PurchaseState>("idle");
  const [offering, setOffering] = useState<BillingOffering | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [entitlementResolution, setEntitlementResolution] = useState<EntitlementResolution>("idle");
  const previousAccessStatus = useRef<string | null>(null);
  const reconciliationGeneration = useRef(0);
  const authenticatedUserId = auth.phase === "authenticated" ? auth.user?.id ?? null : null;

  const configure = useCallback(async () => {
    await purchasesClient.configure(auth.phase === "authenticated" ? auth.user?.id ?? null : null);
  }, [auth.phase, auth.user]);

  const reconcileEntitlement = useCallback(async (incomingCustomerInfo?: BillingCustomerInfo) => {
    if (auth.phase !== "authenticated" || !auth.session?.access_token) {
      setEntitlementResolution("idle");
      return false;
    }
    const generation = reconciliationGeneration.current;
    setEntitlementResolution("checking");
    try {
      await configure();
      const customerInfo = incomingCustomerInfo ?? await purchasesClient.getCustomerInfo();
      if (generation !== reconciliationGeneration.current) return false;
      setSubscription(customerInfo.subscription);
      const refreshed = await refreshEntitlement(auth.session.access_token, customerInfo);
      if (generation !== reconciliationGeneration.current) return false;
      await refreshAccess();
      const providerResolution = resolveEntitlement(customerInfo.subscription);
      const active = providerResolution === "active" && refreshed.access.status === "active";
      setEntitlementResolution(active ? "active" : "expired");
      if (active && onboardingStatus !== "complete") await completeAccess();
      return active;
    } catch (failure) {
      setEntitlementResolution("error");
      throw failure;
    }
  }, [auth.phase, auth.session?.access_token, completeAccess, configure, onboardingStatus, refreshAccess]);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      await configure();
      if (auth.phase === "authenticated") await reconcileEntitlement().catch((failure) => {
        setError(friendlyPurchaseError(failure) || "Your subscription could not be confirmed right now.");
      });
      const nextOffering = await purchasesClient.getOfferings();
      const usableOffering = nextOffering && (REVENUECAT_OFFERING_ID === "default" || nextOffering.identifier === REVENUECAT_OFFERING_ID)
        ? nextOffering
        : null;
      const monthlyPackage = selectMonthlyPackage(usableOffering?.packages ?? []);
      const monthlyOffering = usableOffering && monthlyPackage ? { ...usableOffering, packages: [monthlyPackage] } : null;
      setOffering(monthlyOffering);
      setState(monthlyOffering ? "ready" : "failed");
      if (!monthlyOffering) setError("The Formie monthly subscription is not available right now.");
    } catch (failure) {
      setState("failed");
      setError(friendlyPurchaseError(failure) || null);
    }
  }, [auth.phase, configure, reconcileEntitlement]);

  const syncAccess = useCallback(async () => {
    if (!auth.session?.access_token) return false;
    return reconcileEntitlement();
  }, [auth.session?.access_token, reconcileEntitlement]);

  const purchase = useCallback(async () => {
    if (state === "purchasing" || !offering?.packages[0]) return false;
    setState("purchasing");
    setError(null);
    setRestoreMessage(null);
    try {
      await configure();
      const result = await purchasesClient.purchasePackage(offering.packages[0].identifier);
      setSubscription(result.customerInfo.subscription);
      const active = auth.phase === "authenticated"
        ? await syncAccess()
        : customerHasEntitlement(result.customerInfo, REVENUECAT_ENTITLEMENT_ID);
      if (!active) throw new Error("Purchase completed but the Formie entitlement is still syncing.");
      setState("succeeded");
      return true;
    } catch (failure) {
      const message = friendlyPurchaseError(failure);
      if (!message) setState("cancelled");
      else {
        setState("failed");
        setError(message);
      }
      return false;
    }
  }, [auth.phase, configure, offering?.packages, state, syncAccess]);

  const restore = useCallback(async () => {
    if (state === "restoring") return false;
    setState("restoring");
    setRestoreMessage(null);
    setError(null);
    try {
      await configure();
      const customerInfo = await purchasesClient.restorePurchases();
      setSubscription(customerInfo.subscription);
      const active = auth.phase === "authenticated"
        ? await syncAccess()
        : customerHasEntitlement(customerInfo, REVENUECAT_ENTITLEMENT_ID);
      if (!active) {
        setState("ready");
        setRestoreMessage("No active Formie subscription was found.");
        return false;
      }
      setState("succeeded");
      setRestoreMessage("Purchase restored.");
      return true;
    } catch (failure) {
      setState("failed");
      setError(friendlyPurchaseError(failure) || "");
      return false;
    }
  }, [auth.phase, configure, state, syncAccess]);

  const logOut = useCallback(async () => {
    reconciliationGeneration.current += 1;
    try {
      await purchasesClient.logOut();
    } catch {
      // Auth logout remains authoritative; RevenueCat will be re-identified next login.
    }
    setOffering(null);
    setSubscription(null);
    setState("idle");
    setEntitlementResolution("idle");
    setError(null);
    setRestoreMessage(null);
  }, []);

  useEffect(() => {
    reconciliationGeneration.current += 1;
    setSubscription(null);
    setOffering(null);
    setError(null);
    setRestoreMessage(null);
    setEntitlementResolution("idle");
    if (!authenticatedUserId) setState("idle");
  }, [authenticatedUserId]);

  useEffect(() => {
    void load();
  }, [auth.phase, auth.user, load]);

  useEffect(() => {
    if (auth.phase !== "authenticated") return;
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") void reconcileEntitlement().catch(() => undefined);
    });
    return () => listener.remove();
  }, [auth.phase, reconcileEntitlement]);

  useEffect(() => {
    if (!authenticatedUserId) return;
    return purchasesClient.subscribeCustomerInfo((customerInfo) => {
      void reconcileEntitlement(customerInfo).catch(() => undefined);
    });
  }, [authenticatedUserId, reconcileEntitlement]);

  useEffect(() => {
    const prior = previousAccessStatus.current;
    previousAccessStatus.current = accessStatus;
    if (auth.phase === "authenticated" && accessStatus === "expired" && prior !== "expired") {
      void reconcileEntitlement().catch(() => undefined);
    }
  }, [accessStatus, auth.phase, reconcileEntitlement]);

  const value = useMemo<BillingContextValue>(() => ({
    state,
    entitlementResolution,
    offering,
    priceString: offering?.packages[0]?.priceString ?? null,
    error,
    restoreMessage,
    subscription,
    load,
    purchase,
    restore,
    logOut,
  }), [entitlementResolution, error, load, logOut, offering, purchase, restore, restoreMessage, state, subscription]);

  return <BillingContext value={value}>{children}</BillingContext>;
}

export function useBilling(): BillingContextValue {
  const value = use(BillingContext);
  if (!value) throw new Error("useBilling must be used inside BillingProvider");
  return value;
}

export { REVENUECAT_ENTITLEMENT_ID, REVENUECAT_LAUNCH_VERSION };
export { friendlyPurchaseError } from "./billing-errors";
