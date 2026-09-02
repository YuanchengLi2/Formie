import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Supabase authentication configuration", () => {
  const config = readFileSync(resolve(__dirname, "../../../supabase/config.toml"), "utf8");
  const confirmationTemplate = readFileSync(
    resolve(__dirname, "../../../supabase/templates/confirmation.html"),
    "utf8",
  );
  const recoveryTemplate = readFileSync(
    resolve(__dirname, "../../../supabase/templates/recovery.html"),
    "utf8",
  );

  it("requires verified email accounts and disables new anonymous signups", () => {
    expect(config).toContain("enable_signup = true");
    expect(config).toContain("enable_anonymous_sign_ins = false");
    expect(config).toContain("enable_manual_linking = true");
    expect(config).toContain("[auth.email]");
    expect(config).toMatch(/\[auth\.email\][^[]*enable_signup = true/);
    expect(config).toContain("enable_confirmations = true");
    expect(config).toContain("double_confirm_changes = false");
  });

  it("uses the production Site URL and allowlists native, production-web, and localhost-web callbacks", () => {
    expect(config).toContain('site_url = "https://useformie.com"');
    expect(config).toContain('"form://auth/callback"');
    expect(config).toContain('"https://useformie.com/auth/callback"');
    expect(config).toContain('"http://localhost:3000/auth/callback"');
    expect(config).toContain('"http://localhost:8081/**"');
    expect(config).toContain('"http://localhost:8082/**"');
    expect(config).not.toContain('form://**');
  });

  it("disables unused Google auth and accepts native and web Apple identities", () => {
    expect(config).toMatch(/\[auth\.external\.google\][^[]*enabled = false/);
    expect(config).toMatch(/\[auth\.external\.apple\][^[]*enabled = true/);
    expect(config).toMatch(/client_id = "app\.form\.coach,app\.form\.coach\.signin"/);
  });

  it("preserves the existing MFA and email abuse protections", () => {
    expect(config).toContain("[auth.rate_limit]");
    expect(config).toContain("email_sent = 30");
    expect(config).toContain("[auth.mfa.totp]");
    expect(config).toContain("enroll_enabled = true");
    expect(config).toContain("verify_enabled = true");
    expect(config).toContain('max_frequency = "1m"');
    expect(config).toContain("otp_length = 6");
  });

  it("uses email codes instead of confirmation and recovery links", () => {
    expect(config).toContain("[auth.email.template.confirmation]");
    expect(config).toContain('content_path = "./supabase/templates/confirmation.html"');
    expect(config).toContain("[auth.email.template.recovery]");
    expect(config).toContain('content_path = "./supabase/templates/recovery.html"');
    expect(config).toContain("[auth.email.template.email_change]");
    expect(config).toContain("[auth.email.template.reauthentication]");
    expect(config).toContain('content_path = "./supabase/templates/email-change.html"');
    for (const template of [confirmationTemplate, recoveryTemplate]) {
      expect(template).toContain("{{ .Token }}");
      expect(template).not.toContain("ConfirmationURL");
    }
  });

  it("uses the Formie name in authentication emails without changing the callback scheme", () => {
    expect(config).toContain('sender_name = "Formie"');
    expect(config).toContain("Formie verification code");
    expect(confirmationTemplate).toContain("Formie account");
    expect(recoveryTemplate).toContain("Formie password");
    expect(config).toContain('"form://auth/callback"');
  });

  it("uses Resend custom SMTP without committing sender credentials", () => {
    expect(config).toContain("[auth.email.smtp]");
    expect(config).toContain("enabled = true");
    expect(config).toContain('host = "smtp.resend.com"');
    expect(config).toContain("port = 587");
    expect(config).toContain('user = "resend"');
    expect(config).toContain('pass = "env(FORMIE_RESEND_SMTP_PASS)"');
    expect(config).toContain('admin_email = "auth@useformie.com"');
    expect(config).not.toMatch(/re_[A-Za-z0-9_-]{20,}/);
  });
});
