import { YOUTUBE_TUTORIAL_ELIGIBILITY_VERSION, type TutorialVideo } from "./youtube-tutorial.ts";

export type YouTubeTutorialCacheEntry = {
  payload: TutorialVideo;
  sourceVersion: string;
  verifiedAt: string;
  expiresAt: string;
};

export type YouTubeTutorialCacheDependencies = {
  load: (canonicalExercise: string) => Promise<YouTubeTutorialCacheEntry | null>;
  save: (canonicalExercise: string, entry: YouTubeTutorialCacheEntry) => Promise<void>;
  remove: (canonicalExercise: string) => Promise<void>;
  find: (canonicalExercise: string) => Promise<TutorialVideo | null>;
  now?: () => Date;
};

export async function resolveYouTubeTutorial(canonicalExercise: string, dependencies: YouTubeTutorialCacheDependencies): Promise<TutorialVideo | null> {
  const key = canonicalExercise.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  const now = (dependencies.now ?? (() => new Date()))();
  const cached = await dependencies.load(key);
  const verifiedAt = cached ? Date.parse(cached.verifiedAt) : NaN;
  const expiresAt = cached ? Date.parse(cached.expiresAt) : NaN;
  const current = cached?.sourceVersion === YOUTUBE_TUTORIAL_ELIGIBILITY_VERSION
    && cached.payload.eligibilityVersion === YOUTUBE_TUTORIAL_ELIGIBILITY_VERSION
    && Number.isFinite(verifiedAt)
    && Number.isFinite(expiresAt)
    && now.getTime() - verifiedAt < 24 * 60 * 60 * 1_000
    && expiresAt > now.getTime();
  if (current) return cached!.payload;

  const tutorial = await dependencies.find(canonicalExercise.trim());
  if (!tutorial) {
    if (cached) await dependencies.remove(key);
    return null;
  }
  const verified = new Date(tutorial.verifiedAt);
  const expires = new Date(Math.min(verified.getTime() + 30 * 24 * 60 * 60 * 1_000, now.getTime() + 30 * 24 * 60 * 60 * 1_000));
  await dependencies.save(key, { payload: tutorial, sourceVersion: YOUTUBE_TUTORIAL_ELIGIBILITY_VERSION, verifiedAt: tutorial.verifiedAt, expiresAt: expires.toISOString() });
  return tutorial;
}
