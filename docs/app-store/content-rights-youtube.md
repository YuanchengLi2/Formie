# Formie 1.0 YouTube content-rights basis

- Formie accesses public video metadata through a Formie-controlled Google Cloud project using YouTube Data API v3. The production key is server-only, restricted to the YouTube Data API, and protected by quota alerts.
- Queries contain only the canonical catalog exercise name. Formie never sends a recording, user ID, profile, declaration, free-form note, or analysis result to YouTube.
- Formie uses `search.list`, verifies candidates with `videos.list`, and requires public, processed, embeddable, non-live, non-age-restricted videos. Because Data API v3 has no authoritative Shorts flag, deterministic filtering rejects every video of three minutes or less—the current maximum Shorts duration—as well as overly long videos, promotions, compilations, medical or rehabilitation claims, and mismatched exercise variations.
- Titles, thumbnails, and channel attribution are displayed without modification. The UI identifies YouTube and provides a “Watch on YouTube” action that opens the public YouTube page through the YouTube app when available or the system browser.
- Formie does not download, transcode, rehost, or sell access to YouTube videos. Tutorials do not consume analysis quota and are not a Formie Pro entitlement.
- The global cache is not linked to a Formie user. It is revalidated within 24 hours. An hourly database job deletes expired metadata independently of user traffic, enforcing the 30-day maximum even when an exercise is never opened again.
- App Store Connect Content Rights should be answered **Yes** because the app accesses and displays third-party YouTube metadata and links under the YouTube API Services Terms and Developer Policies.

Last source verification: 2026-09-01. Live API key restriction, quota alert, and production behavior remain release gates.
