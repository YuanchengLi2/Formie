import { resolveYouTubeTutorial, type YouTubeTutorialCacheEntry } from "./youtube-tutorial-cache";
import { YOUTUBE_TUTORIAL_ELIGIBILITY_VERSION } from "./youtube-tutorial";

const tutorial = { source: "youtube_data_api_v3" as const, videoId: "abcdefghijk", url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Hammer Curl Tutorial", channel: "Trusted Coach", channelId: "channel-1", thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", durationSeconds: 360, verifiedAt: "2026-09-01T12:00:00.000Z", eligibilityVersion: YOUTUBE_TUTORIAL_ELIGIBILITY_VERSION };
const entry = (verifiedAt = tutorial.verifiedAt): YouTubeTutorialCacheEntry => ({ payload: { ...tutorial, verifiedAt }, sourceVersion: YOUTUBE_TUTORIAL_ELIGIBILITY_VERSION, verifiedAt, expiresAt: "2026-09-30T12:00:00.000Z" });

it("returns only cache entries revalidated within 24 hours", async () => {
  const find = jest.fn();
  await expect(resolveYouTubeTutorial(" Hammer   Curl ", { load: jest.fn(async () => entry()), save: jest.fn(), remove: jest.fn(), find, now: () => new Date("2026-09-02T11:59:00.000Z") })).resolves.toEqual(tutorial);
  expect(find).not.toHaveBeenCalled();
});

it("revalidates stale entries and stores a maximum 30-day expiry in a global canonical key", async () => {
  const save = jest.fn();
  const find = jest.fn(async () => tutorial);
  await expect(resolveYouTubeTutorial("Hammer Curl", { load: jest.fn(async () => entry("2026-08-30T12:00:00.000Z")), save, remove: jest.fn(), find, now: () => new Date("2026-09-01T12:00:00.000Z") })).resolves.toEqual(tutorial);
  expect(find).toHaveBeenCalledWith("Hammer Curl");
  expect(save).toHaveBeenCalledWith("hammer curl", expect.objectContaining({ expiresAt: "2026-10-01T12:00:00.000Z" }));
});

it("deletes a stale cache entry when no eligible public tutorial remains", async () => {
  const remove = jest.fn();
  await expect(resolveYouTubeTutorial("Hammer Curl", { load: jest.fn(async () => entry("2026-08-30T12:00:00.000Z")), save: jest.fn(), remove, find: jest.fn(async () => null), now: () => new Date("2026-09-01T12:00:00.000Z") })).resolves.toBeNull();
  expect(remove).toHaveBeenCalledWith("hammer curl");
});
