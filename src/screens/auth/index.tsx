import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { FormWordmark } from "@/components/form-wordmark";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

import {
  EMAIL_OTP_LENGTH,
  friendlyAuthError,
  validateDisplayName,
  validateEmail,
  validateOtp,
  validatePassword,
  validatePasswordConfirmation,
} from "@/features/auth/auth-validation";

function AuthShell({
  title,
  detail,
  children,
  verification = false,
}: PropsWithChildren<{ title: string; detail: string; verification?: boolean }>) {
  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        testID={verification ? "verification-content" : undefined}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior={verification ? "never" : "automatic"}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          gap: verification ? spacing.lg : spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingVertical: verification ? spacing.xl : spacing.xxxl,
        }}
      >
        <Animated.View entering={FadeInDown.duration(220)} style={{ width: "100%", maxWidth: 440, alignSelf: "center", gap: verification ? spacing.lg : spacing.xl }}>
          <FormWordmark />
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={[typography.title, { color: colors.text }]}>{title}</Text>
            <Text
              selectable
              style={[
                typography.body,
                verification ? { fontSize: 17, lineHeight: 25 } : null,
                { color: colors.textSecondary },
              ]}
            >
              {detail}
            </Text>
          </View>
          {children}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function VerificationCodeInput({
  value,
  onChangeText,
  error,
}: {
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
}) {
  const inputRef = useRef<TextInput>(null);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={[typography.heading, { color: colors.text }]}>Email code</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enter verification code"
        onPress={() => inputRef.current?.focus()}
        style={{ width: "100%", minHeight: 64, justifyContent: "center" }}
      >
        <View pointerEvents="none" style={{ flexDirection: "row", gap: 6 }}>
          {Array.from({ length: EMAIL_OTP_LENGTH }, (_, index) => {
            const digit = value[index] ?? "";
            const active = index === Math.min(value.length, EMAIL_OTP_LENGTH - 1);
            return (
              <View
                key={index}
                testID={`verification-code-box-${index}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 64,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: active ? 2 : 1,
                  borderColor: error ? colors.danger : active ? colors.gold : colors.border,
                  borderRadius: radii.md,
                  borderCurve: "continuous",
                  backgroundColor: colors.surfaceRaised,
                }}
              >
                <Text selectable={false} style={{ color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: "700" }}>
                  {digit}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          accessibilityLabel="Verification code"
          autoCapitalize="none"
          autoComplete="one-time-code"
          autoCorrect={false}
          caretHidden
          keyboardType="number-pad"
          maxLength={EMAIL_OTP_LENGTH}
          onChangeText={(next) => onChangeText(next.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH))}
          selectionColor="transparent"
          style={{ position: "absolute", inset: 0, color: "transparent", opacity: 0.02 }}
          value={value}
        />
      </Pressable>
      {error ? <Text accessibilityRole="alert" selectable style={[typography.body, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

function AuthField({
  label,
  value,
  onChangeText,
  error,
  password = false,
  otp = false,
  autoComplete,
  autoCapitalize = "none",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  password?: boolean;
  otp?: boolean;
  autoComplete?: "email" | "name" | "password" | "new-password" | "one-time-code";
  autoCapitalize?: "none" | "words";
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text selectable style={[typography.label, { color: colors.text }]}>{label}</Text>
      <View style={{ minHeight: 54, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: error ? colors.danger : colors.border, borderRadius: radii.md, borderCurve: "continuous", backgroundColor: colors.surfaceRaised }}>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          keyboardType={otp ? "number-pad" : autoComplete === "email" ? "email-address" : "default"}
          maxLength={otp ? EMAIL_OTP_LENGTH : undefined}
          onChangeText={onChangeText}
          secureTextEntry={password && !showPassword}
          selectionColor={colors.gold}
          style={[typography.body, { flex: 1, minHeight: 52, paddingHorizontal: spacing.lg, color: colors.text }]}
          value={value}
        />
        {password ? (
          <Pressable accessibilityLabel={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} accessibilityRole="button" onPress={() => setShowPassword((current) => !current)} style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: spacing.lg }}>
            <Text style={[typography.caption, { color: colors.gold }]}>{showPassword ? "Hide" : "Show"}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityRole="alert" selectable style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

function AuthError({ message }: { message: string | null }) {
  return message ? <Text accessibilityRole="alert" selectable style={[typography.body, { color: colors.danger }]}>{message}</Text> : null;
}

function AuthNotice({ message }: { message: string | null }) {
  return message ? <Text testID="auth-notice" selectable style={[typography.body, { color: colors.success }]}>{message}</Text> : null;
}

function TextAction({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 44, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1 }}>
      <Text selectable style={[typography.label, { color: colors.gold }]}>{label}</Text>
    </Pressable>
  );
}

export function AuthLoadingScreen({ message = "Securing your session…" }: { message?: string }) {
  return (
    <View accessibilityLabel="Loading account" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl, backgroundColor: colors.background }}>
      <FormWordmark />
      <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

export function LoginScreen({ onSubmit, onCreateAccount, onForgotPassword, initialError = null, initialNotice = null }: {
  onSubmit: (email: string, password: string) => Promise<void>;
  onCreateAccount: () => void;
  onForgotPassword: () => void;
  initialError?: string | null;
  initialNotice?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(initialError);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const checkedEmail = validateEmail(email);
    const checkedPassword = validatePassword(password);
    setEmailError(checkedEmail.error);
    setPasswordError(checkedPassword.error);
    setSubmitError(null);
    if (checkedEmail.error || checkedPassword.error) return;
    setSubmitting(true);
    try {
      await onSubmit(checkedEmail.value, password);
    } catch (error) {
      setPassword("");
      setSubmitError(friendlyAuthError(error, "Formie couldn't log you in. Check your email and password, then try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back" detail="Log in to review your recordings and continue improving.">
      <View style={{ gap: spacing.lg }}>
        <AuthField label="Email" value={email} onChangeText={(value) => { setEmail(value); setEmailError(null); }} error={emailError} autoComplete="email" />
        <AuthField label="Password" value={password} onChangeText={(value) => { setPassword(value); setPasswordError(null); }} error={passwordError} password autoComplete="password" />
        <AuthNotice message={initialNotice} />
        <AuthError message={submitError} />
        <FormButton label={submitting ? "Logging In…" : "Log In"} disabled={submitting} onPress={() => void submit()} />
        <TextAction label="Forgot password?" onPress={onForgotPassword} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs }}>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>New to Formie?</Text>
        <Pressable accessibilityRole="button" onPress={onCreateAccount}><Text selectable style={[typography.label, { color: colors.gold }]}>Create account</Text></Pressable>
      </View>
    </AuthShell>
  );
}

export type SignUpFormInput = {
  displayName: string;
  email: string;
  password: string;
  legalAcceptedAt: string;
};

export function SignUpScreen({
  onSubmit,
  onBackToLogin,
  onOpenTerms,
  onOpenPrivacy,
}: {
  onSubmit: (input: SignUpFormInput) => Promise<void>;
  onBackToLogin: () => void;
  onOpenTerms: () => Promise<void>;
  onOpenPrivacy: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const checkedDisplayName = validateDisplayName(displayName);
    const checkedEmail = validateEmail(email);
    const checkedPassword = validatePassword(password);
    const checkedConfirmation = validatePasswordConfirmation(password, confirmation);
    setDisplayNameError(checkedDisplayName.error);
    setEmailError(checkedEmail.error);
    setPasswordError(checkedPassword.error);
    setConfirmationError(checkedConfirmation);
    setAgreementError(agreed ? null : "Agree to the Terms of Service and Privacy Policy.");
    setSubmitError(null);
    setSubmitNotice(null);
    if (checkedDisplayName.error || checkedEmail.error || checkedPassword.error || checkedConfirmation || !agreed) return;
    setSubmitting(true);
    try {
      await onSubmit({
        displayName: checkedDisplayName.value,
        email: checkedEmail.value,
        password,
        legalAcceptedAt: new Date().toISOString(),
      });
      setSubmitNotice(`Account created. Your ${EMAIL_OTP_LENGTH}-digit email-code request was accepted.`);
    } catch (error) {
      setSubmitError(friendlyAuthError(error, "Formie couldn't create the account. Check each field and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Create your account" detail="Your recordings and coaching stay private to your account.">
      <View style={{ gap: spacing.lg }}>
        <AuthField
          label="Name"
          value={displayName}
          onChangeText={(value) => {
            setDisplayName(value);
            setDisplayNameError(null);
          }}
          error={displayNameError}
          autoComplete="name"
          autoCapitalize="words"
        />
        <AuthField label="Email" value={email} onChangeText={(value) => { setEmail(value); setEmailError(null); }} error={emailError} autoComplete="email" />
        <AuthField label="Password" value={password} onChangeText={(value) => { setPassword(value); setPasswordError(null); }} error={passwordError} password autoComplete="new-password" />
        <AuthField label="Confirm password" value={confirmation} onChangeText={(value) => { setConfirmation(value); setConfirmationError(null); }} error={confirmationError} password autoComplete="new-password" />
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
            <Pressable
              accessibilityLabel="Agree to Terms of Service and Privacy Policy"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              onPress={() => {
                setAgreed((current) => !current);
                setAgreementError(null);
              }}
              style={{
                width: 24,
                height: 24,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.sm,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: agreed ? colors.gold : colors.border,
                backgroundColor: agreed ? colors.gold : colors.surfaceRaised,
              }}
            >
              <Text selectable={false} style={[typography.label, { color: colors.background }]}>
                {agreed ? "✓" : ""}
              </Text>
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>
                I agree to Formie&apos;s
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs }}>
                <Pressable accessibilityRole="link" onPress={() => void onOpenTerms().catch((error) => setSubmitError(friendlyAuthError(error, "Formie couldn't open the Terms of Service. Check the configured URL.")))}>
                  <Text selectable style={[typography.caption, { color: colors.gold }]}>Terms of Service</Text>
                </Pressable>
                <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>and</Text>
                <Pressable accessibilityRole="link" onPress={() => void onOpenPrivacy().catch((error) => setSubmitError(friendlyAuthError(error, "Formie couldn't open the Privacy Policy. Check the configured URL.")))}>
                  <Text selectable style={[typography.caption, { color: colors.gold }]}>Privacy Policy</Text>
                </Pressable>
              </View>
            </View>
          </View>
          {agreementError ? <Text accessibilityRole="alert" selectable style={[typography.caption, { color: colors.danger }]}>{agreementError}</Text> : null}
        </View>
        <AuthNotice message={submitNotice} />
        <AuthError message={submitError} />
        <FormButton label={submitting ? "Creating Account…" : "Create Account"} disabled={submitting} onPress={() => void submit()} />
        <TextAction label="Back to Log In" onPress={onBackToLogin} />
      </View>
    </AuthShell>
  );
}

export function VerifyEmailScreen({
  email,
  type,
  onResend,
  onVerifyCode,
  onChangeEmail,
  callbackError = null,
}: {
  email: string;
  type: "signup" | "email_change" | "recovery";
  onResend: () => Promise<void>;
  onVerifyCode: (code: string) => Promise<void>;
  onChangeEmail: () => Promise<void>;
  callbackError?: string | null;
}) {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(callbackError);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((current) => Math.max(0, current - 1)), 1_000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (!callbackError) return;
    setError(callbackError);
    setStatus(null);
  }, [callbackError]);
  const [name, domain = ""] = email.split("@");
  const maskedEmail = `${name?.slice(0, 1) ?? ""}***@${domain}`;

  const perform = async (
    operation: () => Promise<void>,
    success?: string,
    fallback = "Formie couldn't complete this verification request. Try again.",
  ) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await operation();
      if (success) setStatus(success);
    } catch (failure) {
      setError(friendlyAuthError(failure, fallback));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    const checked = validateOtp(code);
    setCode(checked.value);
    setCodeError(checked.error);
    if (checked.error) return;
    await perform(
      async () => onVerifyCode(checked.value),
      type === "recovery"
        ? "Code verified. Opening password reset."
        : "Email verified. Continuing to Formie.",
      "Formie couldn't verify that code. Request a new code and try again.",
    );
  };

  const recovery = type === "recovery";
  return (
    <AuthShell
      title={recovery ? "Enter your reset code" : "Verify your email"}
      detail={
        recovery
          ? `Request accepted for ${maskedEmail}. Enter the ${EMAIL_OTP_LENGTH}-digit code from your inbox or spam folder.`
          : `Enter the ${EMAIL_OTP_LENGTH}-digit code for ${maskedEmail}. Check your inbox and spam; delivery can take up to a minute.`
      }
      verification
    >
      <View style={{ gap: spacing.md }}>
        <VerificationCodeInput
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setCodeError(null);
            setError(null);
          }}
          error={codeError}
        />
        {status ? <Text accessibilityRole="alert" selectable style={[typography.caption, { color: colors.success }]}>{status}</Text> : null}
        <AuthError message={error} />
      </View>
      <View style={{ gap: spacing.sm }}>
        <FormButton style={{ minHeight: 62 }} label={busy ? "Verifying…" : "Verify Code"} disabled={busy} onPress={() => void submitCode()} />
        <TextAction
          label={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
          disabled={busy || cooldown > 0}
          onPress={() => void perform(async () => {
            await onResend();
            setCooldown(60);
          }, `Email request accepted. Check your inbox and spam for the new ${EMAIL_OTP_LENGTH}-digit code.`, "Formie couldn't send a new code. Check the email service limits and try again.")}
        />
        <TextAction label="Use a different email" disabled={busy} onPress={() => void perform(onChangeEmail)} />
      </View>
    </AuthShell>
  );
}

export function ForgotPasswordScreen({ onSubmit, onBackToLogin }: {
  onSubmit: (email: string) => Promise<void>;
  onBackToLogin: () => void;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const checked = validateEmail(email);
    setEmailError(checked.error);
    if (checked.error) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(checked.value);
      setSent(true);
    } catch (error) {
      setSubmitError(friendlyAuthError(error, "Formie couldn't send a reset code. Check the email address and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Reset your password" detail={`Enter your email and we'll send an ${EMAIL_OTP_LENGTH}-digit reset code.`}>
      <View style={{ gap: spacing.lg }}>
        <AuthField label="Email" value={email} onChangeText={(value) => { setEmail(value); setEmailError(null); }} error={emailError} autoComplete="email" />
        {sent ? (
          <Text accessibilityRole="alert" selectable style={[typography.body, { color: colors.success }]}>
            Reset request accepted. Check your inbox and spam for the {EMAIL_OTP_LENGTH}-digit code. If no code arrives, confirm this is the email you used for Formie.
          </Text>
        ) : null}
        <AuthError message={submitError} />
        <FormButton label={submitting ? "Sending…" : "Send Reset Code"} disabled={submitting || sent} onPress={() => void submit()} />
        <TextAction label="Back to Log In" onPress={onBackToLogin} />
      </View>
    </AuthShell>
  );
}

export function ResetPasswordScreen({ onSubmit }: {
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const checked = validatePassword(password);
    const confirmationMessage = validatePasswordConfirmation(password, confirmation);
    setPasswordError(checked.error);
    setConfirmationError(confirmationMessage);
    if (checked.error || confirmationMessage) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitNotice(null);
    try {
      await onSubmit(password);
      setSubmitNotice("Password updated. You can now log in with your new password.");
    } catch (error) {
      setSubmitError(friendlyAuthError(error, "Formie couldn't update your password. Choose another password and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      detail="Use a new password you haven’t used elsewhere."
    >
      <View style={{ gap: spacing.lg }}>
        <AuthField label="New password" value={password} onChangeText={(value) => { setPassword(value); setPasswordError(null); }} error={passwordError} password autoComplete="new-password" />
        <AuthField label="Confirm new password" value={confirmation} onChangeText={(value) => { setConfirmation(value); setConfirmationError(null); }} error={confirmationError} password autoComplete="new-password" />
        <AuthNotice message={submitNotice} />
        <AuthError message={submitError} />
        <FormButton label={submitting ? "Saving…" : "Update Password"} disabled={submitting} onPress={() => void submit()} />
      </View>
    </AuthShell>
  );
}
