type SubscriptionManagementDependencies = {
  configure: () => Promise<void>;
  present: () => Promise<void>;
  reconcile: () => Promise<void>;
};

export type SubscriptionPresentation = {
  headlineLead: string;
  headlineAccent: string;
  heroDetail: string;
  badgeLabel: string;
  boundaryRowLabel: string;
  automaticRenewalValue: "On" | "Off" | "Checking";
  showManage: boolean;
  showPurchase: boolean;
};

type PresentationAccess = {
  status: "active" | "expired" | "unknown";
  lifecycleState: "active_renewing" | "active_cancelled" | "renewal_pending" | "expired" | "not_subscribed" | "unknown";
  willRenew: boolean;
  paidThrough: string | null;
};

export function createSubscriptionPresentation(access: PresentationAccess): SubscriptionPresentation {
  if (access.lifecycleState === "active_cancelled") return {
    headlineLead: "Automatic renewal", headlineAccent: "is off", heroDetail: "Your confirmed access and remaining analyses stay available through the paid period.",
    badgeLabel: "Canceled", boundaryRowLabel: "Access ends", automaticRenewalValue: "Off", showManage: true, showPurchase: false,
  };
  if (access.lifecycleState === "renewal_pending") return {
    headlineLead: "Checking your", headlineAccent: "renewal", heroDetail: "Formie is checking the next provider period while keeping your last confirmed access.",
    badgeLabel: "Checking", boundaryRowLabel: "Confirmed through", automaticRenewalValue: "Checking", showManage: true, showPurchase: false,
  };
  if (access.lifecycleState === "expired") return {
    headlineLead: "Your subscription", headlineAccent: "has ended", heroDetail: "Choose Formie again to restore recording access and a fresh analysis balance.",
    badgeLabel: "Expired", boundaryRowLabel: "Access ended", automaticRenewalValue: "Off", showManage: false, showPurchase: true,
  };
  if (access.lifecycleState === "not_subscribed" || access.status === "expired") return {
    headlineLead: "Choose", headlineAccent: "Formie Pro", heroDetail: "Start Formie Monthly with Apple to unlock recording and ten analyses per period.",
    badgeLabel: "Available", boundaryRowLabel: "Billing starts", automaticRenewalValue: "Off", showManage: false, showPurchase: true,
  };
  return {
    headlineLead: "Automatic renewal", headlineAccent: "is on", heroDetail: "Apple reports that Formie Monthly will renew automatically at the current billing boundary.",
    badgeLabel: "Active", boundaryRowLabel: "Next billing", automaticRenewalValue: "On", showManage: true, showPurchase: false,
  };
}

export async function presentSubscriptionManagement({
  configure,
  present,
  reconcile,
}: SubscriptionManagementDependencies): Promise<void> {
  await configure();
  await present();
  void reconcile().catch(() => undefined);
}
