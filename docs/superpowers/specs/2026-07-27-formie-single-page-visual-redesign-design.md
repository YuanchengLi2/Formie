# Formie Single-Page Visual Redesign

## Goal

Replace the current multi-page marketing presentation with one focused, responsive landing page at `https://useformie.com`. The page should explain the complete Formie product through accurate app screens placed inside premium device imagery inspired by the supplied references.

Privacy and Terms remain separate legal documents. Existing marketing routes redirect to matching homepage sections so old links do not break.

## Visual Direction

The design retains Formie's cream, black, and warm-gold palette, condensed editorial headlines, alternating light and dark sections, thin gold paths, and restrained depth.

The primary visuals use a hybrid production method:

1. Generate polished studio environments, phone hardware, lighting, and dimensional composition.
2. Render accurate Formie screen content separately from the app's current UI and supplied references.
3. Composite the accurate screens into the generated devices so all interface text remains legible and truthful.

The website must not ship flattened full-page reference screenshots or AI-generated interface text.

## Page Structure

The header uses anchor navigation:

- How it works
- Coaching
- Progress
- Pricing
- Support

The homepage contains:

1. **Hero** — “See your form differently,” a concise record-understand-improve statement, App Store status, and a dual-device Dashboard/Analysis composition.
2. **How it works** — the three-step recording flow with a camera screen and analysis transition.
3. **Analysis** — one issue connected to its timestamp, score, and full-set summary.
4. **Deeper coaching** — distinct “What happened,” “Why it matters,” and “What to do next” cards alongside muscle-focus and Formie Coach screens.
5. **Progress** — saved analyses, score history, recurring coaching, and the ability to revisit prior sets.
6. **Pricing** — one Formie Pro offer at **$10 for 10 analyses**. It includes:
   - 10 complete form analyses
   - Deeper coaching breakdowns
   - Expanded access to Formie Coach
   - Early access to premium features
   - Priority support
7. **Support and final CTA** — a concise support promise, feedback link, and App Store status.

## Product Visuals

Create three reusable visual compositions:

- **Hero devices:** Dashboard and Analysis screens in two dark phones on a cream studio background with a restrained gold orbit.
- **Analysis journey:** Camera/recording and timestamped correction screens arranged as a clear sequence.
- **Coaching suite:** Coaching cards, Formie Coach conversation, muscle-focus anatomy, and Progress screen on a black-to-gold studio surface.

Desktop uses wider multi-device compositions. Mobile uses dedicated crops and simplified stacking rather than shrinking the desktop canvas.

Screen content must match Formie's actual concepts and current labels. No invented capabilities, fake testimonials, social links, or unavailable App Store claims.

## Navigation and Routes

- `/` is the only marketing page.
- `/how-it-works`, `/coaching`, and `/pricing` redirect to `/#how-it-works`, `/#coaching`, and `/#pricing`.
- `/support` redirects to `/#support`.
- `/privacy` and `/terms` remain standalone legal routes and remain linked in the footer.
- `www.useformie.com` continues redirecting to `useformie.com`.

## Responsive and Accessibility Requirements

- No horizontal overflow from 320px upward.
- Screen text remains readable at common mobile and desktop sizes.
- Anchor links account for the sticky header.
- Generated imagery is decorative where the adjacent copy communicates the same content.
- Accurate screen renders receive descriptive alternative text when they convey unique information.
- All controls have visible keyboard focus and sufficient contrast.
- Reduced-motion users receive static compositions.

## Validation

- Production build and lint pass.
- Every homepage section and anchor works.
- Legacy marketing routes redirect to the correct section.
- Privacy and Terms remain accessible.
- Pricing states exactly “$10 for 10 analyses” and lists all five benefits.
- App Store buttons remain a non-deceptive “Coming to the App Store” state until a real URL is configured.
- Visual checks cover 320px, 390px, 768px, 1440px, and reduced motion.
- The live apex and `www` redirect are verified after deployment.

