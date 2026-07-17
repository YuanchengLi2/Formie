# Formai Motion Polish Design

## Goal

Finish the current dark-and-gold Formai redesign with meaningful motion, evidence-first playback, a dependable video-aware Coach, and the highest-detail Gemini pass that remains compatible with the existing Expo Go and Supabase architecture.

## Analysis and recording tips

The analysis screen will replace the prerecorded progress loop with a native, stage-aware Reanimated composition. A central movement trace, scanning line, evidence points, and three stage labels will change emphasis from `video_check` through `coaching` without showing a fabricated percentage. The animation will remain decorative to screen readers while the real persisted stage list remains accessible.

Recording Tips will retain the existing camera-placement production animation. The hero, motion card, checklist rows, help link, and consent action will enter in a short stagger so the page feels guided instead of static. Motion will stay under 300 milliseconds per element and will not delay interaction.

## Results and playback

Results will remain an evidence-led workspace. The full recording stays visible, timeline scrubbing remains accessible, and AI evidence markers remain tied to their exact timestamps. Coaching-point and purpose changes will use keyed fade/slide transitions, and the selected marker will animate between inactive and active states. The responsive layout remains stacked on phones and side-by-side on wider screens.

## Coach

Coach will keep the selected recording, analysis context, and conversation together. Selecting a coaching moment will be visible in both the video timeline and the composer context. Messages and starter prompts will animate in, successful sends will scroll to the newest response, and the existing optimistic-send, retry, and draft-preservation behavior will remain unchanged. Keyboard avoidance will continue to use the platform-native container.

## Gemini video analysis

The main analysis pass will continue to send the complete original recording with no start or end offsets at 18 FPS. It will add high media resolution so small visible joint and implement details receive the same high-detail treatment as the existing 24 FPS focused evidence review. The focused review remains clipped only around an explicitly uncertain claim. The prompt must continue distinguishing unseen anatomy from visibly incorrect technique; a single recording cannot reveal physically unseen camera angles.

## Verification and cleanup

Each behavior change will begin with a failing Jest test. Completion requires the full Jest suite, TypeScript, lint, Expo Doctor, an Android export, `git diff --check`, a live Expo tunnel check, and confirmation that local and remote Supabase migrations match. Generated Android export directories may be removed after the export result is verified; source assets and user-authored files must be preserved.
