# Formie Website Header, OAuth, and Hero Repair Design

## Goal

Restore the complete marketing navigation, make the header a readable transparent-white glass surface, keep the App Store badge fully opaque, prevent the hero heading from overlapping the product artwork, and make social sign-in navigation deterministic with visible provider icons.

## Design

The shared website header will contain the Formie brand, four navigation destinations (`How it works`, `Coaching`, `Pricing`, and `Manage Subscription`), and the App Store badge. Desktop uses a single centered navigation row. At 900px and below, brand and badge remain on the first row while all four navigation items use a full-width second row, avoiding horizontal scrolling and preserving every destination at 320px. The header background becomes translucent white with blur and saturation; the badge itself remains opacity 1 even while it is a non-clickable coming-soon element.

The hero keeps copy and artwork in independent grid tracks. The artwork width is bounded by its grid column rather than a viewport-width value that can protrude beneath the heading. Below 1040px the layout stacks naturally. This preserves the product image while ensuring the word “differently” always renders against the cream background.

Website Apple and Google buttons reuse the approved mobile provider artwork copied into website public assets. OAuth initiation requests a URL with Supabase automatic redirection disabled. The client validates that an HTTPS provider URL was returned and performs an explicit same-page `window.location.assign`. Missing URLs and provider errors reset the busy state and show an actionable error instead of leaving an inert button.

## Verification

Unit tests validate all four navigation links, provider icons, explicit OAuth options, URL validation, and error behavior. Production browser checks cover 320px, 390px, 768px, and 1440px for overflow, two-row mobile header behavior, badge opacity, and non-overlapping hero rectangles. A live Apple click must leave Formie and reach Apple’s authorization page.
