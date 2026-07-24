# FORM Email and Password Authentication Design

Date: 2026-07-23
Status: Approved in conversation; awaiting written-spec review

## Objective

Add a production-ready Supabase email and password authentication system before expanding onboarding. Signed-out and unverified users must not reach the FORM application. The system must support account creation, mandatory email verification, login, persistent sessions, logout, password recovery, and preservation of recordings already owned by anonymous test accounts.

## Launch Scope

The first release includes:

- Email and password signup.
- Mandatory email verification.
- Email and password login.
- Persistent sessions using the existing secure session storage.
- Forgotten-password email and in-app password reset.
- Logout from Profile.
- Root-level route protection.
- Upgrade of an existing anonymous Supabase user without changing its user ID.
- Clear loading, validation, failure, expired-link, and resend states.

The first release does not include:

- Google, Apple, phone, magic-link, passkey, or multi-factor authentication.
- Display names, usernames, public profiles, or profile photos.
- Guest entry for new installations.
- Authentication-specific analytics.

## Current State

FORM has no authentication screens or route gate. The root route redirects directly to Home. When an API needs a token, `src/features/auth/access-token.ts` creates an anonymous Supabase user if no session exists. Mobile session data is already stored with Expo SecureStore, and analysis records and video storage are already protected by ownership rules based on `auth.uid()`.

The existing behavior means some test devices have analysis history attached to anonymous user IDs. New authentication must preserve that data when those users create permanent accounts.

## Chosen Architecture

### Route organization

Create a dedicated Expo Router `(auth)` group with these routes:

- `login`
- `sign-up`
- `verify-email`
- `forgot-password`
- `reset-password`

The existing application routes remain outside `(auth)`. A central authentication controller in the root layout decides which route tree may render. Individual app screens do not implement their own authentication guards.

### Authentication controller

An `AuthProvider` owns the Supabase authentication lifecycle and exposes a small state machine:

- `initializing`: reading the persisted session and processing an initial deep link.
- `signed_out`: no Supabase session exists.
- `anonymous_upgrade_required`: an existing anonymous user must secure the account before entering FORM.
- `verification_pending`: signup or account upgrade is waiting for email confirmation.
- `password_creation_required`: an upgraded anonymous account has verified its email and must set its password.
- `password_recovery`: a valid recovery link opened the reset flow.
- `authenticated`: a verified, non-anonymous user may enter FORM.

The provider performs one initial `getSession()` call, subscribes to `onAuthStateChange`, listens for incoming Expo Linking URLs, and removes all listeners during cleanup. It must avoid rendering either route tree until initial session and deep-link processing are complete.

### Route gate

The root layout enforces the following navigation:

- `initializing` → branded full-screen loading state.
- `signed_out` → Login, Sign Up, or Forgot Password.
- `anonymous_upgrade_required` → Sign Up in account-upgrade mode.
- `verification_pending` → Verify Email.
- `password_creation_required` → password creation inside the verified upgrade flow.
- `password_recovery` → Reset Password.
- `authenticated` → the existing application.

Signed-in users cannot navigate back into ordinary auth screens. Signed-out, anonymous, and unverified users cannot enter Home, Camera, analysis, Results, Progress, Profile, or Coach routes through a direct link.

## User Experience

### Startup

FORM displays a branded loading screen while resolving the persisted session. Home must never flash before the authentication decision.

### Login

Login contains:

- Email field.
- Password field with visibility control.
- Primary `Log In` action.
- `Forgot password?` action.
- `Create account` action.

The form trims and normalizes email input, never modifies password input, prevents duplicate submissions, focuses the first invalid field, and displays friendly inline errors rather than raw Supabase messages.

### New signup

Sign Up contains:

- Email field.
- Password field.
- Confirm-password field.
- Primary `Create Account` action.
- Link back to Login.

The client validates email shape, password requirements, matching confirmation, and required fields before calling Supabase. A successful signup routes to Verify Email and does not expose the app even if Supabase returns a provisional session.

### Existing anonymous-account upgrade

An existing anonymous user is routed to Sign Up with copy explaining that creating an account preserves existing recordings.

Supabase requires the email identity to be verified before a password is added to an anonymous account. The upgrade sequence is therefore:

1. Submit an email with `updateUser({ email })`.
2. Open the verification link in FORM.
3. Confirm that the same user ID is still active and is no longer awaiting email verification.
4. Ask the user to create and confirm a password.
5. Submit the password with `updateUser({ password })`.
6. Refresh the session and enter the app.

The app never persists a plaintext desired password while waiting for verification. If the proposed email already belongs to another account, FORM explains that the user must sign in to that account. Automatic cross-account data reassignment is outside launch scope because it requires a separately audited ownership-transfer operation.

### Email verification

Verify Email displays:

- Masked destination email.
- `Open Email App` when supported.
- `Resend Email` with a cooldown.
- `I’ve Verified` session-refresh fallback.
- `Use a different email`.
- Link back to Login for ordinary signup.

Opening a valid confirmation link through `form://auth/callback` processes the returned tokens, refreshes the user, and continues automatically. Expired, reused, malformed, or rejected links show a recoverable message and a resend action.

### Password recovery

Forgot Password accepts an email and calls Supabase password recovery with a `form://auth/callback?flow=recovery` redirect. The success message is intentionally neutral so it does not reveal whether an email is registered.

Opening a valid recovery link places the provider in `password_recovery`. Reset Password collects and confirms a new password, updates the authenticated recovery user, signs out the temporary recovery session, and routes to Login with a success message.

### Profile and logout

Profile replaces `Private Guest` with the verified account email and retains the current privacy information. It adds a neutral `Log Out` action. Logout clears the Supabase session and query cache, then returns to Login. Local app assets remain; private server data remains attached to the account.

## Backend and Configuration

### Supabase Auth

The live Supabase project must have:

- Email/password provider enabled.
- Confirm Email enabled.
- Manual identity linking enabled for anonymous upgrades.
- `form://auth/callback` added to the exact redirect allowlist.
- Production Site URL and email templates configured to honor `RedirectTo`.
- Password policy configured consistently with client validation.

After the upgrade path is verified, anonymous signups are disabled in project configuration. Existing anonymous sessions may still complete the upgrade flow, but the client no longer creates new anonymous users.

### Client token behavior

`src/features/auth/access-token.ts` stops calling `signInAnonymously()`. It returns the access token only for an authenticated, verified, non-anonymous session and otherwise raises a typed authentication-required error. Features display or route through the central auth gate instead of silently generating a new identity.

### Authorization

No application table stores passwords or password-reset tokens. Supabase Auth owns credentials and recovery tokens.

The existing database and storage ownership checks using `auth.uid()` remain authoritative. Verification must confirm that:

- A user can access only analysis sessions and videos owned by the same user ID.
- Anonymous upgrade keeps the original user ID and therefore preserves history.
- Logout does not delete server records.
- Signing into another account does not expose the prior account’s cached queries or private records.

### Deep links

The app already registers the `form` URL scheme. One central handler accepts only known authentication callback routes and supported Supabase event types. It ignores unrelated URLs, rejects malformed token payloads, handles cold-start and already-running cases, and never logs access or refresh tokens.

## Error Handling

The UI maps backend errors into stable user-facing categories:

- Invalid email or password.
- Email not verified.
- Email already registered.
- Password does not meet requirements.
- Too many attempts; try again later.
- Network unavailable.
- Verification link expired or invalid.
- Recovery link expired or invalid.
- Account upgrade requires signing into an existing account.
- Unexpected authentication failure.

Forms preserve non-sensitive input after recoverable errors. Password values are cleared after authentication failures where retaining them would be unsafe. Buttons show progress and remain disabled while a request is active.

## Testing Strategy

### Unit and component tests

- Auth state machine transitions.
- Initial session loading without Home flashing.
- Login validation and friendly error mapping.
- Signup validation and verification routing.
- Anonymous upgrade state and preserved user ID.
- Verification resend cooldown.
- Cold-start and warm deep-link parsing.
- Recovery-link routing and password update.
- Duplicate-submit prevention.
- Logout and query-cache clearing.
- Profile email display.

### Route integration tests

- Signed-out users cannot open any protected route.
- Anonymous users are forced into account upgrade.
- Unverified users remain on Verify Email.
- Verified users enter the application and cannot reopen ordinary auth screens.
- Recovery links override the normal route decision until reset is complete.
- Expired and malformed links remain inside the auth flow.

### Backend and security tests

- Signup creates an unverified permanent user.
- Password login fails before verification.
- Generated confirmation link verifies the user.
- Password login succeeds after verification.
- Session survives an app-provider remount.
- Anonymous upgrade preserves the user ID and existing analysis ownership.
- User A cannot read User B’s analysis rows or storage objects.
- Password recovery generates a valid recovery transition.
- Logout invalidates client access without deleting account data.

### Release verification

Run focused authentication tests, the complete Jest suite, TypeScript, lint, Expo Doctor, and iOS export. Verify cold-start and warm-start confirmation and recovery links in an installed development client or TestFlight-compatible build.

Use disposable live users to test signup, generated confirmation links, login, recovery, isolation, and cleanup. Separately complete one real-inbox verification and password-recovery delivery smoke test. Authentication is not considered backend-complete until both link handling and real email delivery succeed.

## References

- Supabase anonymous-account conversion: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase native mobile deep linking: https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- Supabase redirect URL configuration: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase React Native authentication: https://supabase.com/docs/guides/auth/quickstarts/react-native
