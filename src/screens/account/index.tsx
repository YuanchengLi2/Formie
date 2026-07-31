import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { FormButton } from "@/components/form-button";
import {
  EMAIL_OTP_LENGTH,
  friendlyAuthError,
  validateEmail,
  validateOtp,
  validatePassword,
  validatePasswordConfirmation,
} from "@/features/auth/auth-validation";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

function AccountShell({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  error,
  password = false,
  code = false,
  email = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  password?: boolean;
  code?: boolean;
  email?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text selectable style={[typography.label, { color: colors.text }]}>{label}</Text>
      <View style={{ minHeight: 54, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: error ? colors.danger : colors.border, borderRadius: radii.md, backgroundColor: colors.surfaceRaised }}>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoComplete={email ? "email" : password ? "new-password" : code ? "one-time-code" : "off"}
          autoCorrect={false}
          keyboardType={email ? "email-address" : code ? "number-pad" : "default"}
          maxLength={code ? EMAIL_OTP_LENGTH : undefined}
          onChangeText={(next) => onChangeText(code ? next.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH) : next)}
          secureTextEntry={password && !revealed}
          style={[typography.body, { flex: 1, minHeight: 52, paddingHorizontal: spacing.lg, color: colors.text }]}
          value={value}
        />
        {password ? <Pressable accessibilityRole="button" accessibilityLabel={`${revealed ? "Hide" : "Show"} ${label.toLowerCase()}`} onPress={() => setRevealed((current) => !current)} style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: spacing.lg }}><Text style={[typography.caption, { color: colors.gold }]}>{revealed ? "Hide" : "Show"}</Text></Pressable> : null}
      </View>
      {error ? <Text accessibilityRole="alert" selectable style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

function RequestError({ message }: { message: string | null }) {
  return message ? <Text accessibilityRole="alert" selectable style={[typography.body, { color: colors.danger }]}>{message}</Text> : null;
}

export function ChangeEmailScreen({
  currentEmail,
  onRequest,
  onVerify,
  onResend,
  onComplete,
}: {
  currentEmail: string;
  onRequest: (email: string) => Promise<void>;
  onVerify: (email: string, code: string) => Promise<void>;
  onResend: (email: string) => Promise<void>;
  onComplete: () => void;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request = async () => {
    const checked = validateEmail(newEmail);
    setNewEmail(checked.value);
    setFieldError(checked.error);
    setError(null);
    if (checked.error || busy) return;
    if (checked.value === currentEmail.trim().toLowerCase()) {
      setFieldError("Enter a different email address.");
      return;
    }
    setBusy(true);
    try {
      await onRequest(checked.value);
      setRequestedEmail(checked.value);
      setNotice(`We sent a six-digit code to ${checked.value}.`);
    } catch (failure) {
      setError(friendlyAuthError(failure, "Formie couldn't send the email-change code. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!requestedEmail || busy) return;
    const checked = validateOtp(code);
    setCode(checked.value);
    setFieldError(checked.error);
    setError(null);
    if (checked.error) return;
    setBusy(true);
    try {
      await onVerify(requestedEmail, checked.value);
      onComplete();
    } catch (failure) {
      setError(friendlyAuthError(failure, "Formie couldn't verify that code. Request a new code and try again."));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!requestedEmail || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onResend(requestedEmail);
      setNotice("A new six-digit code is on the way.");
    } catch (failure) {
      setError(friendlyAuthError(failure, "Formie couldn't resend the code. Try again in a minute."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Change Email</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{requestedEmail ? "Enter the six-digit code from your new inbox." : `Your current verified email is ${currentEmail}.`}</Text>
      </View>
      {requestedEmail ? (
        <>
          <Field label="Verification code" value={code} onChangeText={(value) => { setCode(value); setFieldError(null); }} error={fieldError} code />
          {notice ? <Text selectable style={[typography.caption, { color: colors.success }]}>{notice}</Text> : null}
          <RequestError message={error} />
          <FormButton label={busy ? "Verifying…" : "Verify New Email"} disabled={busy} onPress={() => void verify()} />
          <FormButton label="Resend Code" variant="ghost" disabled={busy} onPress={() => void resend()} />
        </>
      ) : (
        <>
          <Field label="New email" value={newEmail} onChangeText={(value) => { setNewEmail(value); setFieldError(null); }} error={fieldError} email />
          <RequestError message={error} />
          <FormButton label={busy ? "Sending…" : "Send Verification Code"} disabled={busy} onPress={() => void request()} />
        </>
      )}
    </AccountShell>
  );
}

export function ChangePasswordScreen({
  onRequestCode,
  onUpdate,
  onComplete,
}: {
  onRequestCode: () => Promise<void>;
  onUpdate: (password: string, code: string) => Promise<void>;
  onComplete: () => void;
}) {
  const [requested, setRequested] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onRequestCode();
      setRequested(true);
    } catch (failure) {
      setError(friendlyAuthError(failure, "Formie couldn't send a security code. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const update = async () => {
    if (busy) return;
    const checkedCode = validateOtp(code);
    const checkedPassword = validatePassword(password);
    const checkedConfirmation = validatePasswordConfirmation(password, confirmation);
    setCode(checkedCode.value);
    setCodeError(checkedCode.error);
    setPasswordError(checkedPassword.error);
    setConfirmationError(checkedConfirmation);
    setError(null);
    if (checkedCode.error || checkedPassword.error || checkedConfirmation) return;
    setBusy(true);
    try {
      await onUpdate(password, checkedCode.value);
      onComplete();
    } catch (failure) {
      setError(friendlyAuthError(failure, "Formie couldn't change your password. Check the code and password, then try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Change Password</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{requested ? "Enter the six-digit security code and choose a new password." : "We'll email a security code before changing your password."}</Text>
      </View>
      {requested ? (
        <>
          <Field label="Security code" value={code} onChangeText={(value) => { setCode(value); setCodeError(null); }} error={codeError} code />
          <Field label="New password" value={password} onChangeText={(value) => { setPassword(value); setPasswordError(null); }} error={passwordError} password />
          <Field label="Confirm new password" value={confirmation} onChangeText={(value) => { setConfirmation(value); setConfirmationError(null); }} error={confirmationError} password />
          <RequestError message={error} />
          <FormButton label={busy ? "Changing…" : "Change Password"} disabled={busy} onPress={() => void update()} />
          <FormButton label="Resend Security Code" variant="ghost" disabled={busy} onPress={() => void request()} />
        </>
      ) : (
        <>
          <RequestError message={error} />
          <FormButton label={busy ? "Sending…" : "Send Security Code"} disabled={busy} onPress={() => void request()} />
        </>
      )}
    </AccountShell>
  );
}
