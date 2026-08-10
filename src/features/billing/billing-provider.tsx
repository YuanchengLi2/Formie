import { AppState } from "react-native";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { useAccess } from "@/features/access/access-provider";

import { REVENUECAT_ENTITLEMENT_ID, REVENUECAT_LAUNCH_VERSION, REVENUECAT_OFFERING_ID } from "./constants";
import { refreshEntitlement } from "./api";
import { purchasesClient } from "./purchases";
import type { BillingCustomerInfo, BillingOffering, BillingPlanCode, BillingPlans, BillingSubscription, EntitlementResolution, PurchaseOutcome, PurchaseState } from "./types";
import { friendlyPurchaseError } from "./billing-errors";
import { selectBillingPlans } from "./billing-package";
import { customerHasEntitlement } from "./purchase-access";
import { reconcileWithDeadline } from "./reconciliation-retry";
import { createPurchaseOperationId, isCurrentPurchaseOperation, resolvePassiveBillingStateFromSnapshot, resolvePurchaseOutcome, resolveServerProductIdentifier, type ReconciliationSnapshot } from "./purchase-reconciliation";
import { presentSubscriptionManagement } from "./subscription-management-presentation";

const STORE_OPERATION_TIMEOUT_MS = 45_000;

export type BillingContextValue = {
  state: PurchaseState;
  entitlementResolution: EntitlementResolution;
  offering: BillingOffering | null;
  plans: BillingPlans;
  priceString: string | null;
  error: string | null;
  restoreMessage: string | null;
  subscription: BillingSubscription | null;
  load: () => Promise<void>;
  purchase: (planCode?: BillingPlanCode) => Promise<PurchaseOutcome>;
  retryPurchaseSync: () => Promise<boolean>;
  restore: () => Promise<boolean>;
  manageSubscription: () => Promise<void>;
  logOut: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

function timeoutError(): Error {
  return new Error("The store is taking longer than expected to confirm this purchase.");
}

async function withTimeout<T>(operation: Promise<T>, milliseconds = STORE_OPERATION_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(timeoutError()), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
  const purchaseOperation = useRef<string | null>(null);
  const authenticatedUserId = auth.phase === "authenticated" ? auth.user?.id ?? null : null;

  const configure = useCallback(async () => {
    await purchasesClient.configure(auth.phase === "authenticated" ? auth.user?.id ?? null : null);
  }, [auth.phase, auth.user]);

  const reconcileEntitlement = useCallback(async (incomingCustomerInfo?: BillingCustomerInfo, purchasedProductIdentifier?: string): Promise<ReconciliationSnapshot> => {
    if (auth.phase !== "authenticated" || !auth.session?.access_token) {
      setEntitlementResolution("idle");
      return { providerActive: false, serverActive: false, serverLifecycleState: "unknown", customerInfo: incomingCustomerInfo ?? null, providerProductIdentifier: incomingCustomerInfo?.subscription?.productIdentifier ?? null, serverProductIdentifier: null };
    }
    const generation = reconciliationGeneration.current;
    setEntitlementResolution("checking");
    try {
      await configure();
      const customerInfo = incomingCustomerInfo ?? await purchasesClient.getCustomerInfo();
      if (generation !== reconciliationGeneration.current) return { providerActive: false, serverActive: false, serverLifecycleState: "unknown", customerInfo: null, providerProductIdentifier: null, serverProductIdentifier: null };
      const providerActive = customerHasEntitlement(customerInfo, REVENUECAT_ENTITLEMENT_ID);
      const providerProductIdentifier = customerInfo.subscription?.productIdentifier ?? purchasedProductIdentifier ?? null;
      setSubscription(customerInfo.subscription);
      const refreshed = await refreshEntitlement(auth.session.access_token);
      if (generation !== reconciliationGeneration.current) return { providerActive, serverActive: false, serverLifecycleState: "unknown", customerInfo, providerProductIdentifier, serverProductIdentifier: null };
      await refreshAccess().catch(() => undefined);
      const serverActive = refreshed.access.status === "active";
      const serverProductIdentifier = resolveServerProductIdentifier(refreshed.subscription.productIdentifier, refreshed.access.productIdentifier);
      const active = providerActive && serverActive;
      setEntitlementResolution(active ? "active" : providerActive && refreshed.access.lifecycleState === "renewal_pending" ? "checking" : "expired");
      if (active && onboardingStatus !== "complete") await completeAccess();
      return { providerActive, serverActive, serverLifecycleState: refreshed.access.lifecycleState, customerInfo, providerProductIdentifier, serverProductIdentifier };
    } catch (failure) {
      setEntitlementResolution("error");
      throw failure;
    }
  }, [auth.phase, auth.session?.access_token, completeAccess, configure, onboardingStatus, refreshAccess]);

  const finishPassiveReconciliation = useCallback((result: ReconciliationSnapshot, offeringAvailable: boolean): boolean => {
    if (purchaseOperation.current) return false;
    if (result.providerActive && result.serverActive) {
      setState("succeeded");
      setEntitlementResolution("active");
      setError(null);
      if (onboardingStatus !== "complete") void completeAccess();
      return true;
    }

    const passiveState = resolvePassiveBillingStateFromSnapshot(result, offeringAvailable);
    setState(passiveState);
    if (passiveState === "sync_required") {
      setEntitlementResolution("checking");
      setError("Formie is still confirming your subscription. Tap Check purchase to retry.");
    } else {
      setEntitlementResolution(result.serverLifecycleState === "unknown" ? "error" : "expired");
      setError(null);
    }
    return false;
  }, [completeAccess, onboardingStatus]);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    let reconciliation: ReconciliationSnapshot | null = null;
    try {
      await configure();
      if (auth.phase === "authenticated") {
        reconciliation = await reconcileEntitlement().catch((failure) => {
          setError(friendlyPurchaseError(failure) || "Your subscription could not be confirmed right now.");
          return null;
        });
      }
      const nextOffering = await purchasesClient.getOfferings();
      const usableOffering = nextOffering && (REVENUECAT_OFFERING_ID === "default" || nextOffering.identifier === REVENUECAT_OFFERING_ID)
        ? nextOffering
        : null;
      const nextPlans = selectBillingPlans(usableOffering?.packages ?? []);
      setOffering(usableOffering && (nextPlans.monthly || nextPlans.annual) ? usableOffering : null);
      const offeringAvailable = Boolean(nextPlans.monthly || nextPlans.annual);
      if (reconciliation) finishPassiveReconciliation(reconciliation, offeringAvailable);
      else setState(offeringAvailable ? "ready" : "failed");
      if (!nextPlans.monthly && !nextPlans.annual) setError("Formie plans are not available right now.");
    } catch (failure) {
      setState("failed");
      setError(friendlyPurchaseError(failure) || null);
    }
  }, [auth.phase, configure, finishPassiveReconciliation, reconcileEntitlement]);

  const syncAccess = useCallback(async (incomingCustomerInfo?: BillingCustomerInfo, expectedProductIdentifier?: string, purchasedProductIdentifier?: string) => {
    if (!auth.session?.access_token) {
      return { value: { providerActive: false, serverActive: false, serverLifecycleState: "unknown", customerInfo: null, providerProductIdentifier: null, serverProductIdentifier: null } as ReconciliationSnapshot, satisfied: false, attempts: 0 };
    }
    let firstAttempt = true;
    let knownCustomerInfo = incomingCustomerInfo ?? null;
    return reconcileWithDeadline(
      async () => {
        const customerInfo = firstAttempt ? incomingCustomerInfo : undefined;
        firstAttempt = false;
        try {
          const snapshot = await reconcileEntitlement(customerInfo, purchasedProductIdentifier);
          knownCustomerInfo = snapshot.customerInfo ?? knownCustomerInfo;
          return snapshot;
        } catch {
          setEntitlementResolution("checking");
          return {
            providerActive: knownCustomerInfo ? customerHasEntitlement(knownCustomerInfo, REVENUECAT_ENTITLEMENT_ID) : false,
            serverActive: false,
            serverLifecycleState: "unknown",
            customerInfo: knownCustomerInfo,
            providerProductIdentifier: knownCustomerInfo?.subscription?.productIdentifier ?? null,
            serverProductIdentifier: null,
          } satisfies ReconciliationSnapshot;
        }
      },
      (snapshot) => snapshot.providerActive
        && snapshot.serverActive
        && (!expectedProductIdentifier || (snapshot.providerProductIdentifier === expectedProductIdentifier && snapshot.serverProductIdentifier === expectedProductIdentifier)),
    );
  }, [auth.session?.access_token, reconcileEntitlement]);

  const finishReconciliation = useCallback((result: { value: ReconciliationSnapshot; satisfied: boolean }, operationId?: string, expectedProductIdentifier?: string): boolean => {
    if (operationId && !isCurrentPurchaseOperation(purchaseOperation.current, operationId)) return false;
    const productConfirmed = !expectedProductIdentifier || (result.value.providerProductIdentifier === expectedProductIdentifier && result.value.serverProductIdentifier === expectedProductIdentifier);
    const outcome = productConfirmed && result.value.customerInfo
      ? resolvePurchaseOutcome(result.value.customerInfo, REVENUECAT_ENTITLEMENT_ID, result.value.serverActive)
      : productConfirmed && result.value.providerActive && result.value.serverActive ? "active" : result.value.providerActive ? "sync_required" : "failed";
    if (outcome === "active") {
      setState("succeeded");
      setEntitlementResolution("active");
      setError(null);
      if (onboardingStatus !== "complete") void completeAccess();
      return true;
    }
    if (result.value.providerActive) {
      setState("sync_required");
      setEntitlementResolution("checking");
      setError("Purchase received. Formie is still confirming access. Tap Check purchase to retry.");
    } else {
      setState("ready");
      setEntitlementResolution("expired");
      setError(null);
    }
    return false;
  }, [completeAccess, onboardingStatus]);

  const purchase = useCallback(async (planCode: BillingPlanCode = "monthly"): Promise<PurchaseOutcome> => {
    const selectedPackage = selectBillingPlans(offering?.packages ?? [])[planCode];
    if (!selectedPackage) return "failed";
    if (state === "purchasing" || state === "reconciling" || state === "sync_required") return "sync_required";
    const operationId = createPurchaseOperationId();
    purchaseOperation.current = operationId;
    setState("purchasing");
    setError(null);
    setRestoreMessage(null);
    try {
      await configure();
      const result = await withTimeout(purchasesClient.purchasePackage(selectedPackage.identifier, { currentProductIdentifier: serverAccess.productIdentifier }));
      if (!isCurrentPurchaseOperation(purchaseOperation.current, operationId)) return "cancelled";
      setSubscription(result.customerInfo.subscription);
      if (!customerHasEntitlement(result.customerInfo, REVENUECAT_ENTITLEMENT_ID)) {
        setState("failed");
        setError("The completed purchase did not include the Formie entitlement.");
        return "failed";
      }
      setState("reconciling");
      const reconciliation = auth.phase === "authenticated"
        ? await syncAccess(result.customerInfo, selectedPackage.productIdentifier, result.productIdentifier)
        : { value: { providerActive: true, serverActive: true, serverLifecycleState: "active_renewing", customerInfo: result.customerInfo, providerProductIdentifier: result.productIdentifier, serverProductIdentifier: result.productIdentifier } satisfies ReconciliationSnapshot, satisfied: true, attempts: 1 };
      const active = finishReconciliation(reconciliation, operationId, selectedPackage.productIdentifier);
      return active ? "active" : "sync_required";
    } catch (failure) {
      if (!isCurrentPurchaseOperation(purchaseOperation.current, operationId)) return "cancelled";
      const message = friendlyPurchaseError(failure);
      if (failure instanceof Error && failure.message.includes("taking longer")) {
        setState("sync_required");
        setEntitlementResolution("checking");
        setError("Purchase check required. Tap Check purchase before trying again.");
        return "sync_required";
      }
      if (!message) {
        setState("cancelled");
        return "cancelled";
      }
      setState("failed");
      setError(message);
      return "failed";
    } finally {
      if (isCurrentPurchaseOperation(purchaseOperation.current, operationId)) purchaseOperation.current = null;
    }
  }, [auth.phase, configure, finishReconciliation, offering?.packages, serverAccess.productIdentifier, state, syncAccess]);

  const retryPurchaseSync = useCallback(async (): Promise<boolean> => {
    if (state === "purchasing" || state === "reconciling") return false;
    const operationId = createPurchaseOperationId();
    purchaseOperation.current = operationId;
    setState("reconciling");
    setError(null);
    try {
      await configure();
      const customerInfo = await purchasesClient.getCustomerInfo();
      if (!isCurrentPurchaseOperation(purchaseOperation.current, operationId)) return false;
      setSubscription(customerInfo.subscription);
      if (!customerHasEntitlement(customerInfo, REVENUECAT_ENTITLEMENT_ID)) {
        setState("ready");
        setEntitlementResolution("expired");
        setError(null);
        return false;
      }
      const reconciliation = auth.phase === "authenticated"
        ? await syncAccess(customerInfo)
        : { value: { providerActive: true, serverActive: true, serverLifecycleState: "active_renewing", customerInfo, providerProductIdentifier: customerInfo.subscription?.productIdentifier ?? null, serverProductIdentifier: customerInfo.subscription?.productIdentifier ?? null } satisfies ReconciliationSnapshot, satisfied: true, attempts: 1 };
      return finishReconciliation(reconciliation, operationId);
    } catch (failure) {
      if (isCurrentPurchaseOperation(purchaseOperation.current, operationId)) {
        setState("sync_required");
        setEntitlementResolution("checking");
        setError(friendlyPurchaseError(failure) || "Purchase check is still pending. Try again shortly.");
      }
      return false;
    } finally {
      if (isCurrentPurchaseOperation(purchaseOperation.current, operationId)) purchaseOperation.current = null;
    }
  }, [auth.phase, configure, finishReconciliation, state, syncAccess]);

  const restore = useCallback(async () => {
    if (state === "restoring" || state === "purchasing" || state === "reconciling") return false;
    setState("restoring");
    setRestoreMessage(null);
    setError(null);
    try {
      await configure();
      const customerInfo = await withTimeout(purchasesClient.restorePurchases());
      setSubscription(customerInfo.subscription);
      if (!customerHasEntitlement(customerInfo, REVENUECAT_ENTITLEMENT_ID)) {
        setState("ready");
        setEntitlementResolution("expired");
        setRestoreMessage("No active Formie subscription was found.");
        return false;
      }
      setState("reconciling");
      const reconciliation = auth.phase === "authenticated"
        ? await syncAccess(customerInfo)
        : { value: { providerActive: true, serverActive: true, serverLifecycleState: "active_renewing", customerInfo, providerProductIdentifier: customerInfo.subscription?.productIdentifier ?? null, serverProductIdentifier: customerInfo.subscription?.productIdentifier ?? null } satisfies ReconciliationSnapshot, satisfied: true, attempts: 1 };
      if (finishReconciliation(reconciliation)) {
        setRestoreMessage("Purchase restored.");
        return true;
      }
      setRestoreMessage("Purchase found. Formie is still confirming access.");
      return false;
    } catch (failure) {
      setState("failed");
      setError(friendlyPurchaseError(failure) || "");
      return false;
    }
  }, [auth.phase, configure, finishReconciliation, state, syncAccess]);

  const manageSubscription = useCallback(async () => {
    setError(null);
    try {
      await presentSubscriptionManagement({
        configure,
        present: purchasesClient.showManageSubscriptions,
        reconcile: async () => {
          const reconciliation = await syncAccess();
          finishPassiveReconciliation(reconciliation.value, Boolean(offering));
        },
      });
    } catch (failure) {
      setError(friendlyPurchaseError(failure) || "Subscription management could not be opened. Try again from Settings.");
      throw failure;
    }
  }, [configure, finishPassiveReconciliation, offering, syncAccess]);

  const logOut = useCallback(async () => {
    reconciliationGeneration.current += 1;
    purchaseOperation.current = null;
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
    purchaseOperation.current = null;
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
      if (next === "active") {
        void syncAccess().then((result) => finishPassiveReconciliation(result.value, Boolean(offering))).catch(() => undefined);
      }
    });
    return () => listener.remove();
  }, [auth.phase, finishPassiveReconciliation, offering, syncAccess]);

  useEffect(() => {
    if (!authenticatedUserId) return;
    const generation = reconciliationGeneration.current;
    return purchasesClient.subscribeCustomerInfo((customerInfo) => {
      if (generation !== reconciliationGeneration.current) return;
      setSubscription(customerInfo.subscription);
      void syncAccess(customerInfo).then((result) => finishPassiveReconciliation(result.value, Boolean(offering))).catch(() => undefined);
    });
  }, [authenticatedUserId, finishPassiveReconciliation, offering, syncAccess]);

  useEffect(() => {
    if (accessStatus === "active" && (state === "sync_required" || state === "reconciling")) {
      setState("succeeded");
      setEntitlementResolution("active");
      setError(null);
      if (onboardingStatus !== "complete") void completeAccess();
    }
  }, [accessStatus, completeAccess, onboardingStatus, state]);

  useEffect(() => {
    const prior = previousAccessStatus.current;
    previousAccessStatus.current = accessStatus;
    if (auth.phase === "authenticated" && accessStatus === "expired" && prior !== "expired") {
      void reconcileEntitlement().then((result) => {
        finishPassiveReconciliation(result, Boolean(offering));
      }).catch(() => undefined);
    }
  }, [accessStatus, auth.phase, finishPassiveReconciliation, offering, reconcileEntitlement]);

  const plans = useMemo(() => selectBillingPlans(offering?.packages ?? []), [offering]);
  const value = useMemo<BillingContextValue>(() => ({
    state,
    entitlementResolution,
    offering,
    plans,
    priceString: plans.monthly?.priceString ?? null,
    error,
    restoreMessage,
    subscription,
    load,
    purchase,
    retryPurchaseSync,
    restore,
    manageSubscription,
    logOut,
  }), [entitlementResolution, error, load, logOut, manageSubscription, offering, plans, purchase, restore, restoreMessage, retryPurchaseSync, state, subscription]);

  return <BillingContext value={value}>{children}</BillingContext>;
}

export function useBilling(): BillingContextValue {
  const value = use(BillingContext);
  if (!value) throw new Error("useBilling must be used inside BillingProvider");
  return value;
}

export { REVENUECAT_ENTITLEMENT_ID, REVENUECAT_LAUNCH_VERSION };
export { friendlyPurchaseError } from "./billing-errors";
