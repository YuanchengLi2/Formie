# Formie One-Page Website, Complete Coaching, and Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved single-page Formie website, add evidence-backed setup and exercise guidance to analysis results, and finish the authenticated Resend feedback integration.

**Architecture:** Keep the Next.js marketing site independent under `website/`. Extend the existing analysis result contract with a compact exercise guide and a domain coverage audit so the model must inspect more than movement form. Reuse the deployed authenticated Supabase feedback function and configure its Resend domain/key without exposing secrets to the app.

**Tech Stack:** Next.js 16, React 19, CSS, Expo Router, React Native, Zod, Supabase Edge Functions/Postgres, Gemini structured output, Resend, Vercel.

## Global Constraints

- Use one agent only.
- Preserve unrelated changes in the dirty checkout.
- The marketing site is one scrolling page; Privacy and Terms remain standalone legal routes.
- Pricing is exactly `$10 for 10 analyses`.
- Benefits are 10 complete form analyses, deeper coaching breakdowns, expanded Formie Coach access, early premium-feature access, and priority support.
- App Store buttons remain “Coming to the App Store” until a real URL exists.
- Coaching claims must be supported by visible evidence; never invent hazards, pain, muscle activation, hidden mechanics, or unreadable load.

---

### Task 1: Single-page website contract

**Files:**
- Modify: `website/app/page.tsx`
- Modify: `website/components/site-shell.tsx`
- Modify: `website/components/app-visuals.tsx`
- Modify: `website/app/globals.css`
- Modify: `website/app/how-it-works/page.tsx`
- Modify: `website/app/coaching/page.tsx`
- Modify: `website/app/pricing/page.tsx`
- Modify: `website/app/support/page.tsx`
- Create: `website/app/page.test.tsx`

**Interfaces:**
- Produces homepage anchors `#how-it-works`, `#analysis`, `#coaching`, `#progress`, `#pricing`, and `#support`.
- Produces redirects from legacy marketing routes to homepage anchors.

- [ ] Write a failing page contract test asserting every section, the exact price, five benefits, legal links, and non-deceptive App Store copy.
- [ ] Run the test and confirm it fails because the current page is multi-route and still says `$9.99/month`.
- [ ] Build the single-page React structure and anchor navigation.
- [ ] Replace marketing routes with Next redirects to homepage anchors.
- [ ] Run the page test until it passes.

### Task 2: Generated product imagery and responsive presentation

**Files:**
- Create: `website/public/assets/formie-hero-product.png`
- Create: `website/public/assets/formie-journey-product.png`
- Create: `website/public/assets/formie-coaching-product.png`
- Modify: `website/app/page.tsx`
- Modify: `website/app/globals.css`

**Interfaces:**
- Consumes the three approved generated concept images.
- Produces responsive `<Image>` placements with useful crops and no flattened full-page screenshot.

- [ ] Copy the three approved product images into versioned website assets.
- [ ] Add the product images to their matching semantic sections.
- [ ] Add mobile-specific crops, `sizes`, dimensions, and decorative alt handling.
- [ ] Validate at 320px, 390px, 768px, and 1440px with no horizontal overflow.

### Task 3: Complete coaching coverage contract

**Files:**
- Modify: `supabase/functions/_shared/analysis-contract.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.ts`
- Modify: `supabase/functions/_shared/single-pass-analysis.test.ts`
- Modify: `supabase/functions/_shared/result-payload.ts`
- Modify: `supabase/functions/_shared/result-payload.test.ts`
- Modify: `src/features/analysis/result-schema.ts`
- Modify: `src/features/analysis/result-schema.test.ts`
- Create: `supabase/migrations/202607270054_complete_coaching_coverage.sql`
- Modify: `supabase/functions/analyze-video/index.ts`

**Interfaces:**
- Produces `exerciseGuide: { setupSteps: string[]; executionSteps: string[]; relatedFindingIds: string[] }`.
- Produces `coachingCoverage: Array<{ domain: "surroundings" | "equipment_setup" | "grip_contact" | "starting_position" | "movement_execution" | "support_balance"; status: "issue" | "clear" | "not_visible"; observation: string; findingIds: string[] }>`.

- [ ] Add failing parser/schema tests for a complete six-domain audit and exercise guide.
- [ ] Run tests and confirm failure because the fields are not supported.
- [ ] Extend Gemini JSON schema and parser with exact domain coverage, valid finding references, and `not_visible` handling.
- [ ] Strengthen the prompt so every domain is checked and corrections remain evidence-backed.
- [ ] Persist both fields atomically and expose them through `resultPayload`.
- [ ] Run parser, payload-parity, and client schema tests until they pass.

### Task 4: “How to set up and do this exercise” UI

**Files:**
- Modify: `src/screens/results/index.tsx`
- Modify: `src/screens/results/results.test.tsx`

**Interfaces:**
- Consumes `AnalysisResult.exerciseGuide` and `AnalysisResult.coachingCoverage`.
- Produces a results section titled `How to set up and do this exercise` with Set up and Do the exercise subsections.

- [ ] Add a failing screen test for the new heading, setup steps, execution steps, and evidence-backed domain chips.
- [ ] Run the screen test and confirm the section is absent.
- [ ] Render the section after the coaching summary and before the next-set plan.
- [ ] Hide unsupported domains marked `not_visible`; keep historical results readable when the new fields are absent.
- [ ] Run results UI tests until they pass.

### Task 5: Deploy and verify the analysis extension

**Files:**
- Modify: `scripts/smoke-analysis-live.ts`

**Interfaces:**
- Live acceptance requires six coverage domains, an openable public result, and at least one setup and one execution step.

- [ ] Add smoke assertions for `exerciseGuide`, exact domain coverage, valid finding references, and mobile schema parsing.
- [ ] Run focused tests, TypeScript, and lint.
- [ ] Push the migration and deploy `analyze-video` plus `analysis-status` if its serializer changes.
- [ ] Run one live disposable analysis and confirm it completes and opens.

### Task 6: Finish Resend configuration

**Files:**
- Existing: `supabase/functions/send-feedback/index.ts`
- Existing: `supabase/functions/send-feedback/handler.ts`

**Interfaces:**
- Consumes Supabase secrets `RESEND_API_KEY`, `FORMIE_FEEDBACK_FROM`, and `FORMIE_FEEDBACK_TO`.
- Sends from `Formie <feedback@useformie.com>` to `yuanchengli612@gmail.com` with the authenticated user as Reply-To.

- [ ] Resume the open Resend dashboard with Computer Use.
- [ ] Add `useformie.com`; if the account requires a paid plan, stop before purchase and request explicit authorization.
- [ ] Add only the Resend-provided DNS records in GoDaddy while preserving unrelated records.
- [ ] Create a sending-only, domain-restricted API key after explicit confirmation.
- [ ] Save the key only as a Supabase secret and redeploy `send-feedback`.
- [ ] Verify unauthenticated rejection, then request confirmation before sending one real feedback email.

### Task 7: Build, deploy, and live website verification

**Files:**
- Modify: `website/app/layout.tsx`
- Modify: `website/vercel.json`

**Interfaces:**
- Production URL remains `https://useformie.com`.

- [ ] Run website lint and production build.
- [ ] Deploy the linked `website/` project to Vercel.
- [ ] Verify homepage anchors, legacy redirects, Privacy, Terms, HTTPS, apex canonicalization, and `www` redirect.
- [ ] Verify desktop/mobile rendering and zero horizontal overflow.
