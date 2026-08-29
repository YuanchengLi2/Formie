import { isAdminEmail } from "./access";
import { parseDashboardSnapshot, type AdminDashboardSnapshot } from "./dashboard-data";
import type { DashboardFilters } from "./dashboard-filters";

export class AdminAccessError extends Error {
  constructor() {
    super("Founder authentication required");
    this.name = "AdminAccessError";
  }
}

export type AdminDashboardDependencies = {
  getAuthenticatedEmail: () => Promise<string | null>;
  getSnapshot: (filters: DashboardFilters) => Promise<unknown>;
};

export async function loadAdminDashboard(dependencies: AdminDashboardDependencies, configuredEmail: string | undefined, filters: DashboardFilters = { window: "30d", exerciseId: null }): Promise<{ adminEmail: string; snapshot: AdminDashboardSnapshot }> {
  const email = await dependencies.getAuthenticatedEmail();
  if (!isAdminEmail(email, configuredEmail)) throw new AdminAccessError();
  const snapshot = parseDashboardSnapshot(await dependencies.getSnapshot(filters));
  return { adminEmail: email!, snapshot };
}
