# Expired Access Boundary Correction Design

## Outcome

Subscription expiry limits paid analysis creation without removing access to the native Formie account. The website account portal has the stricter boundary: expired and never-subscribed users stay authenticated but cannot see subscription dashboard data.

## Native application behavior

- A completed authenticated profile may enter Home, saved analyses, coaching, progress, and profile whether its entitlement is active or expired.
- Loading or unknown access remains blocking because Formie cannot safely determine whether paid mutations are available.
- Expired access changes the center action to `Purchase`; selecting it opens the existing native subscription screen.
- Active access with zero remaining analyses remains a disabled `0 analyses left` state and never becomes a purchase prompt.
- Recording and reanalysis continue to use the authoritative server-side entitlement and quota checks, so changing navigation does not weaken mutation enforcement.
- Initial onboarding premium purchase remains required before the profile is marked complete. This correction applies to returning completed accounts, not unfinished onboarding.

## Website behavior

- `/manage-subscription` owns its complete viewport and does not render the public marketing header or footer.
- Active renewing and active cancelled-paid-through subscribers see the dark account dashboard and navigation rail.
- Expired and never-subscribed completed accounts see a minimal full-screen recovery view instead of the dashboard.
- The recovery view uses neutral gold styling, explains that saved account data remains available in Formie, and provides Open Formie, support, and sign-out actions.
- The recovery view does not show the red Expired pill, quota cards, plan cards, management row, or dashboard sidebar.
- Realtime dashboard refreshes can transition the page directly between the active dashboard and recovery view without a new login.

## Boundary rationale

Authentication, account visibility, and paid analysis entitlement are separate concerns. Native account history remains useful after expiry, while the subscription website is an entitlement-specific portal whose private dashboard is meaningful only during a paid-through period. Server-side reservation remains the ultimate authority for paid analysis use.
