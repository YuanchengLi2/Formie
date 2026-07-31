import { friendlyAuthError, validateDisplayName, validateEmail, validateOtp, validatePassword, validatePasswordConfirmation } from "./auth-validation";

describe("auth form validation", () => {
  it("normalizes valid email and rejects malformed email", () => {
    expect(validateEmail("  USER@Example.COM ")).toEqual({ value: "user@example.com", error: null });
    expect(validateEmail("not-an-email").error).toBe("Enter a valid email address.");
  });

  it("requires a useful password and matching confirmation", () => {
    expect(validatePassword("short").error).toBe("Use at least 8 characters.");
    expect(validatePassword("long-enough").error).toBeNull();
    expect(validatePasswordConfirmation("long-enough", "different")).toBe("Passwords do not match.");
    expect(validatePasswordConfirmation("long-enough", "long-enough")).toBeNull();
  });

  it("requires the configured six-digit email code", () => {
    expect(validateOtp("12 34-56")).toEqual({ value: "123456", error: null });
    expect(validateOtp("1234")).toEqual({ value: "1234", error: "Enter the 6-digit code from your email." });
  });

  it("normalizes a useful display name and rejects empty or oversized names", () => {
    expect(validateDisplayName("  Yuan   Cheng  ")).toEqual({ value: "Yuan Cheng", error: null });
    expect(validateDisplayName(" ")).toEqual({ value: "", error: "Enter your name." });
    expect(validateDisplayName("A")).toEqual({ value: "A", error: "Use at least 2 characters." });
    expect(validateDisplayName("A".repeat(61)).error).toBe("Use 60 characters or fewer.");
  });

  it("maps backend details to stable user-facing messages", () => {
    expect(friendlyAuthError({ message: "Invalid login credentials" })).toBe("The email or password is incorrect.");
    expect(friendlyAuthError({ message: "Email not confirmed" })).toBe("Verify your email before logging in.");
    expect(friendlyAuthError({ message: "User already registered" })).toBe("An account already exists for this email.");
    expect(friendlyAuthError({ message: "rate limit exceeded" })).toBe("Too many attempts. Try again in a few minutes.");
    expect(friendlyAuthError({ message: "Email address not authorized" })).toBe("Supabase's test email service can only send codes to project team emails.");
    expect(friendlyAuthError({ code: "otp_expired", message: "Token has expired or is invalid" })).toBe("That verification code is invalid or expired. Request a new code.");
    expect(friendlyAuthError(new TypeError("Network request failed"))).toBe("Check your connection and try again.");
    expect(friendlyAuthError(
      { message: "database detail that should stay private" },
      "Formie couldn't verify that code. Request a new code and try again.",
    )).toBe("Formie couldn't verify that code. Request a new code and try again.");
  });

  it("maps Supabase Auth error codes to specific recovery actions", () => {
    expect(friendlyAuthError({ code: "email_not_confirmed", message: "Request rejected" })).toBe(
      "Verify your email before logging in.",
    );
    expect(friendlyAuthError({ code: "email_exists", message: "Request rejected" })).toBe(
      "An account already exists for this email.",
    );
    expect(friendlyAuthError({ code: "email_address_invalid", message: "Request rejected" })).toBe(
      "Enter a valid email address.",
    );
    expect(friendlyAuthError({ code: "email_provider_disabled", message: "Request rejected" })).toBe(
      "New account creation is temporarily unavailable.",
    );
    expect(friendlyAuthError({ code: "over_email_send_rate_limit", message: "Request rejected" })).toBe(
      "Too many email codes were requested. Wait a minute, then try again.",
    );
    expect(friendlyAuthError({ code: "unexpected_failure", message: "Error sending confirmation email" })).toBe(
      "Formie reached the email service, but it could not send the verification code. Try again in a minute.",
    );
    expect(friendlyAuthError({ code: "unexpected_failure", message: "Database error saving new user" })).toBe(
      "Formie reached the account service, but it could not save your account. Try again in a minute.",
    );
  });
});
