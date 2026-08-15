import { z } from "zod";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const successSchema = z.object({ deleted: z.literal(true) }).strict();
const deletionStageSchema = z.enum(["storage", "analytics", "auth_user"]);
const safeErrorSchema = z.object({
  message: z.string().min(1).max(250),
  code: z.enum([
    "METHOD_NOT_ALLOWED",
    "INVALID_BODY",
    "UNAUTHORIZED",
    "STORAGE_DELETE_FAILED",
    "ANALYTICS_DELETE_FAILED",
    "AUTH_USER_DELETE_FAILED",
  ]),
  stage: deletionStageSchema.optional(),
}).strict();

export type AccountDeletionStage = z.infer<typeof deletionStageSchema>;

export class AccountDeletionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly stage?: AccountDeletionStage,
  ) {
    super(message);
    this.name = "AccountDeletionError";
  }
}

function resolveBaseUrl(value?: string): string {
  const configured = value ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!configured) {
    throw new AccountDeletionError("Account deletion is not configured", 0, "MISSING_CONFIGURATION");
  }
  return configured.endsWith("/functions/v1")
    ? configured
    : `${configured.replace(/\/$/, "")}/functions/v1`;
}

export async function deleteAccount(input: {
  accessToken: string;
  baseUrl?: string;
  fetcher?: Fetcher;
  signal?: AbortSignal;
}): Promise<{ deleted: true }> {
  let response: Response;
  try {
    response = await (input.fetcher ?? fetch)(`${resolveBaseUrl(input.baseUrl)}/delete-account`, {
      method: "POST",
      signal: input.signal,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmation: "DELETE" }),
    });
  } catch (error) {
    if (error instanceof AccountDeletionError) throw error;
    throw new AccountDeletionError("Network request failed. Try again.", 0, "NETWORK_ERROR");
  }

  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const parsedError = safeErrorSchema.safeParse(payload);
    if (parsedError.success) {
      throw new AccountDeletionError(
        parsedError.data.message,
        response.status,
        parsedError.data.code,
        parsedError.data.stage,
      );
    }
    throw new AccountDeletionError("Your account could not be deleted. Try again.", response.status, "REQUEST_FAILED");
  }

  const parsedSuccess = successSchema.safeParse(payload);
  if (!parsedSuccess.success) {
    throw new AccountDeletionError("Server returned an invalid response", response.status, "INVALID_RESPONSE");
  }
  return parsedSuccess.data;
}
