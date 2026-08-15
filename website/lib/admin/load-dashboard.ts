import { isAdminEmail } from "./access";
import { parseDashboardSnapshot, type AdminDashboardSnapshot } from "./dashboard-data";

export class AdminAccessError extends Error {
  constructor() {
    super("Founder authentication required");
    this.name = "AdminAccessError";
  }
}

export type AdminDashboardDependencies = {
  getAuthenticatedEmail: () => Promise<string | null>;
  getSnapshot: () => Promise<unknown>;
};

export async function loadAdminDashboard(dependencies: AdminDashboardDependencies, configuredEmail: string | undefined): Promise<{ adminEmail: string; snapshot: AdminDashboardSnapshot }> {
  const email = await dependencies.getAuthenticatedEmail();
  if (!isAdminEmail(email, configuredEmail)) throw new AdminAccessError();
  const snapshot = parseDashboardSnapshot(await dependencies.getSnapshot());
  return { adminEmail: email!, snapshot };
}
