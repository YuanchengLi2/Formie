type SubscriptionManagementDependencies = {
  configure: () => Promise<void>;
  present: () => Promise<void>;
  reconcile: () => Promise<void>;
};

export async function presentSubscriptionManagement({
  configure,
  present,
  reconcile,
}: SubscriptionManagementDependencies): Promise<void> {
  await configure();
  await present();
  void reconcile().catch(() => undefined);
}
