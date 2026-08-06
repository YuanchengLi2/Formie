# Website Header, OAuth, and Hero Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This checkout explicitly requires single-agent inline execution, so do not dispatch subagents.

**Goal:** Repair website social sign-in and restore a readable, responsive marketing header and hero.

**Architecture:** Isolate OAuth URL creation and validation in a testable helper, leaving the React client responsible only for busy/error UI and explicit navigation. Keep header and hero behavior in their existing shared component and stylesheet boundaries, using a two-row mobile header and grid-contained hero artwork.

**Tech Stack:** Next.js 16, React 19, Supabase SSR/JS, TypeScript, CSS, Node test runner, Vercel.

---

## File map

- Create `website/lib/oauth-redirect.ts`: request and validate provider authorization URLs without allowing the SDK to navigate implicitly.
- Create `website/lib/oauth-redirect.test.ts`: verify redirect target, `skipBrowserRedirect`, provider errors, and missing/unsafe URLs.
- Modify `website/app/manage-subscription/manage-subscription-client.tsx`: render provider icons and explicitly assign the validated OAuth URL.
- Modify `website/app/manage-subscription/manage-subscription.test.tsx`: assert both accessible provider icons and signed-out login content.
- Modify `website/components/site-shell.tsx`: restore the three homepage anchors and retain Manage Subscription as the fourth destination.
- Modify `website/app/globals.css`: implement glass header, opaque badge, four-link responsive navigation, and icon/button layout.
- Modify `website/app/landing-v2.css`: contain hero artwork inside its grid track and preserve stacked responsive behavior.
- Modify `website/app/page.test.tsx`: assert restored navigation, glass-header rules, opaque badge, and bounded hero art.
- Create `website/public/assets/apple-provider.png` and `website/public/assets/google-provider.png`: reuse the already-approved mobile provider icons.

### Task 1: Deterministic OAuth navigation

- [ ] Add failing tests to `website/lib/oauth-redirect.test.ts` for `skipBrowserRedirect: true`, callback URL construction, HTTPS URL validation, provider errors, and missing URLs.
- [ ] Run `npm --prefix website test` and confirm failures occur because the helper does not exist.
- [ ] Implement `beginWebsiteOAuth(client, provider, origin)` in `website/lib/oauth-redirect.ts`. It must call `signInWithOAuth`, reject errors and non-HTTPS/missing URLs, and return the validated string.
- [ ] Update `manage-subscription-client.tsx` to call the helper and use `window.location.assign(url)`; reset busy state and show the current retryable error on failure.
- [ ] Run website tests and confirm the OAuth tests pass.

### Task 2: Provider identity and navigation restoration

- [ ] Add failing component assertions that Apple and Google icons are present with accessible alternative text and that all four header links render.
- [ ] Reuse `assets/production/onboarding/apple-icon.png` and `google-icon.png` under `website/public/assets/`.
- [ ] Render the icons with `next/image` inside the social buttons while keeping busy labels and disabled behavior intact.
- [ ] Restore `How it works`, `Coaching`, and `Pricing` anchors in `site-shell.tsx`, followed by `/manage-subscription`.
- [ ] Add CSS grid alignment for provider icons so labels remain centered independently of icon width.

### Task 3: Glass header and non-overlapping hero

- [ ] Add failing CSS/source assertions for a translucent white header, opacity-1 badge, mobile two-row navigation, and grid-bounded hero artwork.
- [ ] Change `.site-header` to an `rgba(255,255,255,.82)` background with blur and saturation while preserving contrast and sticky positioning.
- [ ] Replace the 760px single-row override with a full-width second navigation row. At 360px, use four equal navigation columns and compact typography without hiding or horizontally scrolling links.
- [ ] Change `.v2-hero-art` from viewport-width sizing to `width: 100%; max-width: 100%`; keep the grid track and stacked breakpoint responsible for composition.
- [ ] Ensure the hero copy track uses `minmax(0, ...)`, has a bounded heading width, and never shares visual space with the image.

### Task 4: Verification and deployment

- [ ] Run `npm --prefix website test`, `npm --prefix website run lint`, and the production Vercel build/deployment.
- [ ] Inspect production at 320x568, 390x844, 768x900, and 1440x1000. Confirm `scrollWidth <= clientWidth`, four links are visible, header/badge opacity is correct, and the hero copy/art rectangles do not overlap.
- [ ] Click Apple in production and verify navigation reaches `https://appleid.apple.com/auth/authorize...`.
- [ ] Leave the existing dirty root worktree unstaged so unrelated work is not captured.
