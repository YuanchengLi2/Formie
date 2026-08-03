import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("authentication routing", () => {
  it("protects every application route behind the root auth gate", () => {
    const layout = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf8");
    expect(layout).toContain("<AuthProvider>");
    expect(layout).toContain("<ProfileProvider>");
    expect(layout).toContain("<Stack.Protected guard={appUnlocked}>");
    expect(layout).not.toContain("onboardingRequired");
    expect(layout).toContain("<Stack.Protected guard={signedOut}>");
    expect(layout).toContain("<Stack.Protected guard={verificationPending}>");
    expect(layout).toContain("<Stack.Protected guard={passwordSetupRequired}>");
    expect(layout).toContain('name="(tabs)"');
    expect(layout.indexOf("<Stack.Protected guard={appUnlocked}>")).toBeLessThan(layout.indexOf('name="(tabs)"'));
  });

  it("includes all launch authentication routes and a callback route", () => {
    for (const route of [
      "login.tsx",
      "sign-up.tsx",
      "verify-email.tsx",
      "forgot-password.tsx",
      "reset-password.tsx",
      "auth/callback.tsx",
    ]) {
      expect(existsSync(resolve(__dirname, `../../app/(auth)/${route}`))).toBe(true);
    }
  });

  it("hoists auth screens into the root navigator instead of creating a second navigator", () => {
    const layout = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf8");
    expect(existsSync(resolve(__dirname, "../../app/(auth)/_layout.tsx"))).toBe(false);
    for (const route of [
      "(auth)/login",
      "(auth)/sign-up",
      "(auth)/verify-email",
      "(auth)/forgot-password",
      "(auth)/reset-password",
      "(auth)/auth/callback",
    ]) {
      expect(layout).toContain(`name="${route}"`);
    }
  });

  it("routes startup to login or home based on the auth phase", () => {
    const index = readFileSync(resolve(__dirname, "../../app/index.tsx"), "utf8");
    expect(index).toContain('phase === "authenticated"');
    expect(index).not.toContain("onboarding");
    expect(index).toContain('href="/(tabs)/(home)"');
    expect(index).toContain('"/login"');
  });

  it("does not register or ship onboarding routes", () => {
    expect(existsSync(resolve(__dirname, "../../app/(onboarding)"))).toBe(false);
  });

  it("validates legal URLs when opened without blocking account creation", () => {
    const signup = readFileSync(resolve(__dirname, "../../app/(auth)/sign-up.tsx"), "utf8");
    const submitBlock = signup.match(/onSubmit=\{async \(input\) => \{([\s\S]*?)\n\s*\}\}\n\s*onOpenTerms/)?.[1];
    expect(submitBlock).toBeDefined();
    expect(submitBlock).not.toContain("getLegalLinks");
    expect(signup).toContain("getLegalLinks");
    expect(signup).toContain("Linking.openURL");
  });

  it("exposes only the four-field signup flow", () => {
    const layout = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf8");
    const index = readFileSync(resolve(__dirname, "../../app/index.tsx"), "utf8");
    const signup = readFileSync(resolve(__dirname, "../../app/(auth)/sign-up.tsx"), "utf8");
    const screen = readFileSync(resolve(__dirname, "../../screens/auth/index.tsx"), "utf8");

    expect(layout).not.toContain('phase === "anonymous_upgrade_required"');
    expect(index).not.toContain('phase === "anonymous_upgrade_required"');
    expect(signup).not.toContain("startAnonymousUpgrade");
    expect(signup).not.toContain("upgradeAnonymous");
    expect(screen).not.toContain("Keep your recordings");
    expect(screen).not.toContain("upgradeAnonymous");
  });

  it("uses protected-route guards instead of render-time redirects for auth phase changes", () => {
    const login = readFileSync(resolve(__dirname, "../../app/(auth)/login.tsx"), "utf8");
    const signup = readFileSync(resolve(__dirname, "../../app/(auth)/sign-up.tsx"), "utf8");
    const forgotPassword = readFileSync(resolve(__dirname, "../../app/(auth)/forgot-password.tsx"), "utf8");
    const verifyEmail = readFileSync(resolve(__dirname, "../../app/(auth)/verify-email.tsx"), "utf8");
    const resetPassword = readFileSync(resolve(__dirname, "../../app/(auth)/reset-password.tsx"), "utf8");
    const callback = readFileSync(resolve(__dirname, "../../app/(auth)/auth/callback.tsx"), "utf8");

    for (const source of [login, signup, forgotPassword, verifyEmail, callback]) {
      expect(source).not.toContain("useEffect");
      expect(source).not.toContain("<Redirect");
    }
    expect(resetPassword).not.toContain("<Redirect");

    const signupSubmit = signup.match(/onSubmit=\{async \(input\) => \{([\s\S]*?)\n\s*\}\}\n\s*onOpenTerms/)?.[1] ?? "";
    const loginSubmit = login.match(/onSubmit=\{async \(email, password\) => \{([\s\S]*?)\n\s*\}\}/)?.[1] ?? "";
    const recoverySubmit = forgotPassword.match(/onSubmit=\{async \(email\) => \{([\s\S]*?)\n\s*\}\}/)?.[1] ?? "";
    const codeSubmit = verifyEmail.match(/onVerifyCode=\{async \(code\) => \{([\s\S]*?)\n\s*\}\}/)?.[1] ?? "";
    for (const submit of [signupSubmit, loginSubmit, recoverySubmit, codeSubmit]) {
      expect(submit).not.toContain("router.replace");
    }

    const resetSubmit = resetPassword.match(/onSubmit=\{async \(password\) => \{([\s\S]*?)\n\s*\}\}/)?.[1] ?? "";
    expect(resetSubmit).not.toContain("router.replace");
    expect(resetPassword).not.toContain("useRouter");
    expect(resetPassword).not.toContain("resetComplete");
    expect(resetPassword).not.toContain("resetInProgress");
    expect(resetPassword).not.toContain("/login?reset=complete");

    expect(verifyEmail).toContain("verifyEmailOtp");
    expect(verifyEmail).not.toContain("onRefresh");
  });
});
