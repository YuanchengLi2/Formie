# Native Onboarding Artwork Design

## Visual contract

The approved ZIP is the only visual source. Marketing artwork is copied pixel-for-pixel from the approved screens through deterministic cropping and dark-background alpha masking. It is never redrawn, regenerated, traced, simplified, or replaced with generic icons.

Each marketing screen has exactly three layers: native Formie navigation/progress, native accessible headline/body copy, and one illustration-only transparent PNG. The illustration contains the approved product composition and its internal product labels, but excludes the screenshot headline, device frame, Dynamic Island, progress bar, CTA, and page background. Native CTA controls sit below the illustration.

The premium screen uses native accessible copy, live RevenueCat price, benefits, purchase control, and error state. Exact approved decorative objects are extracted from the paywall source and positioned behind the native pricing card. No full-screen paywall screenshot or invisible purchase overlay is used.

## Responsive behavior

Artwork uses `contain` without a framed wrapper. Standard, compact, and short phone layouts vary the artwork height and text size while preserving the original aspect ratio. The real safe area owns the top and bottom spacing. Content may shrink, but artwork and text never overlap the CTA.

## Verification

Component tests require native copy, illustration-only asset identifiers, accessible Back/Continue controls, exact paywall decorative assets, and the absence of full screenshot assets or screenshot overlays. Visual QA compares rendered phone screens against the approved ZIP at standard and short-phone dimensions.
