export type ValidatedField = { value: string; error: string | null };
export const EMAIL_OTP_LENGTH = 6;

export function validateDisplayName(input: string): ValidatedField {
  const value = input.trim().replace(/\s+/g, " ");
  if (!value) return { value, error: "Enter your name." };
  if (value.length < 2) return { value, error: "Use at least 2 characters." };
  if (value.length > 60) return { value, error: "Use 60 characters or fewer." };
  return { value, error: null };
}

export function validateEmail(input: string): ValidatedField {
  const value = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { value, error: "Enter a valid email address." };
  return { value, error: null };
}

export function validatePassword(password: string): ValidatedField {
  if (password.length < 8) return { value: password, error: "Use at least 8 characters." };
  return { value: password, error: null };
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return "Confirm your password.";
  return password === confirmation ? null : "Passwords do not match.";
}

export function validateOtp(input: string): ValidatedField {
  const value = input.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH);
  if (value.length !== EMAIL_OTP_LENGTH) {
    return { value, error: `Enter the ${EMAIL_OTP_LENGTH}-digit code from your email.` };
  }
  return { value, error: null };
}

function backendMessage(error: unknown): string {
  if (!error || typeof error !== "object" || !("message" in error)) return "";
  return String(error.message).toLowerCase();
}

function backendCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String(error.code).toLowerCase();
}

export function friendlyAuthError(
  error: unknown,
  fallback = "Formie couldn't complete this account request. Check your information and try again.",
): string {
  const message = backendMessage(error);
  const code = backendCode(error);
  if (error instanceof TypeError || message.includes("network") || message.includes("fetch")) return "Check your connection and try again.";
  if (code === "invalid_credentials" || message.includes("invalid login") || message.includes("invalid credentials")) return "The email or password is incorrect.";
  if (code === "email_not_confirmed" || message.includes("email not confirmed") || message.includes("email_not_confirmed")) return "Verify your email before logging in.";
  if (code === "email_exists" || code === "identity_already_exists" || message.includes("already registered") || message.includes("already exists") || message.includes("identity already")) return "An account already exists for this email.";
  if (code === "email_address_invalid") return "Enter a valid email address.";
  if (code === "email_provider_disabled") return "New account creation is temporarily unavailable.";
  if (message.includes("weak password") || message.includes("password should") || message.includes("password must")) return "Use a stronger password with at least 8 characters.";
  if (code === "over_email_send_rate_limit") return "Too many email codes were requested. Wait a minute, then try again.";
  if (code === "over_request_rate_limit" || message.includes("rate limit") || message.includes("too many") || message.includes("only request this after")) {
    return "Too many attempts. Try again in a few minutes.";
  }
  if (message.includes("email address not authorized")) return "Supabase's test email service can only send codes to project team emails.";
  if (message.includes("sending confirmation email") || message.includes("sending recovery email") || message.includes("smtp")) {
    return "Formie reached the email service, but it could not send the verification code. Try again in a minute.";
  }
  if (message.includes("database error saving new user")) {
    return "Formie reached the account service, but it could not save your account. Try again in a minute.";
  }
  if (code === "otp_expired" || message.includes("token has expired") || message.includes("otp_expired") || message.includes("invalid otp")) {
    return "That verification code is invalid or expired. Request a new code.";
  }
  return fallback;
}
