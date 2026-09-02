import { ExternalDeletionError, type ExternalDeletionRequest } from "./external-deletion.ts";

export type ProviderDeletionDependencies = {
  revokeApple: (refreshToken: string) => Promise<void>;
  deleteGeminiFile: (fileName: string) => Promise<void>;
  deleteRevenueCatCustomer: (customerId: string) => Promise<void>;
};

function requiredPayload(payload: Record<string, string>, key: string): string {
  const value = payload[key]?.trim();
  if (!value) throw new ExternalDeletionError("INVALID_DELETION_PAYLOAD", false);
  return value;
}

function providerStatus(error: unknown): number | null {
  if (error && typeof error === "object" && "httpStatus" in error && Number.isInteger(error.httpStatus)) return Number(error.httpStatus);
  const match = error instanceof Error ? error.message.match(/(?:failed:?|\()\s*(\d{3})/i) : null;
  return match ? Number(match[1]) : null;
}

export async function executeProviderDeletion(request: ExternalDeletionRequest, dependencies: ProviderDeletionDependencies): Promise<void> {
  try {
    if (request.provider === "apple" && request.operation === "revoke_authorization") return await dependencies.revokeApple(requiredPayload(request.payload, "refreshToken"));
    if (request.provider === "gemini" && request.operation === "delete_file") return await dependencies.deleteGeminiFile(requiredPayload(request.payload, "fileName"));
    if (request.provider === "revenuecat" && request.operation === "delete_customer") return await dependencies.deleteRevenueCatCustomer(requiredPayload(request.payload, "customerId"));
    throw new ExternalDeletionError("UNSUPPORTED_DELETION_OPERATION", false);
  } catch (error) {
    if (error instanceof ExternalDeletionError) throw error;
    const status = providerStatus(error);
    throw new ExternalDeletionError(status ? `HTTP_${status}` : "PROVIDER_DELETE_FAILED", status === 408 || status === 409 || status === 429 || Boolean(status && status >= 500));
  }
}
