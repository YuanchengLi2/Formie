import { createYouTubeTutorialClient, YOUTUBE_TUTORIAL_ELIGIBILITY_VERSION } from "./youtube-tutorial";

const id = (value: string) => ({ id: { videoId: value }, snippet: {} });
const video = (videoId: string, title: string, overrides: Record<string, unknown> = {}) => ({
  id: videoId,
  snippet: { title, description: "Clear technique instruction", channelTitle: "Trusted Coach", channelId: "channel-1", liveBroadcastContent: "none", thumbnails: { high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` } } },
  contentDetails: { duration: "PT6M", contentRating: {} },
  status: { privacyStatus: "public", uploadStatus: "processed", embeddable: true },
  ...overrides,
});

it("queries only the canonical exercise and deterministically returns eligible unmodified YouTube metadata", async () => {
  const fetcher = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({ items: [id("abcdefghijk"), id("lmnopqrstuv")] }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ items: [video("lmnopqrstuv", "Hammer Curl Workout Compilation"), video("abcdefghijk", "Hammer Curl Tutorial")] }), { status: 200 }));
  const client = createYouTubeTutorialClient({ apiKey: "key", fetcher, now: () => new Date("2026-09-01T12:00:00.000Z") });
  await expect(client.findTutorial("Hammer Curl")).resolves.toEqual({ source: "youtube_data_api_v3", videoId: "abcdefghijk", url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Hammer Curl Tutorial", channel: "Trusted Coach", channelId: "channel-1", thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", durationSeconds: 360, verifiedAt: "2026-09-01T12:00:00.000Z", eligibilityVersion: YOUTUBE_TUTORIAL_ELIGIBILITY_VERSION });
  const searchUrl = new URL(String(fetcher.mock.calls[0][0]));
  expect(searchUrl.pathname).toBe("/youtube/v3/search");
  expect(Object.fromEntries(searchUrl.searchParams)).toMatchObject({ q: "Hammer Curl", type: "video", safeSearch: "strict", videoEmbeddable: "true", regionCode: "US", relevanceLanguage: "en" });
  expect(String(fetcher.mock.calls[1][0])).toContain("/youtube/v3/videos");
});

it("rejects private, unprocessed, non-embeddable, live, age-restricted, Shorts up to three minutes, medical, promotional, and mismatched variations", async () => {
  const ids = ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd", "eeeeeeeeeee", "fffffffffff", "ggggggggggg", "hhhhhhhhhhh", "iiiiiiiiiii", "jjjjjjjjjjj"];
  const items = [
    video(ids[0], "Dumbbell Row Tutorial", { status: { privacyStatus: "private", uploadStatus: "processed", embeddable: true } }),
    video(ids[1], "Dumbbell Row Tutorial", { status: { privacyStatus: "public", uploadStatus: "uploaded", embeddable: true } }),
    video(ids[2], "Dumbbell Row Tutorial", { status: { privacyStatus: "public", uploadStatus: "processed", embeddable: false } }),
    video(ids[3], "Dumbbell Row Tutorial", { snippet: { ...video(ids[3], "x").snippet, title: "Dumbbell Row Tutorial", liveBroadcastContent: "live" } }),
    video(ids[4], "Dumbbell Row Tutorial", { contentDetails: { duration: "PT6M", contentRating: { ytRating: "ytAgeRestricted" } } }),
    video(ids[5], "Dumbbell Row Tutorial", { contentDetails: { duration: "PT3M", contentRating: {} } }),
    video(ids[6], "Dumbbell Row #Shorts", { contentDetails: { duration: "PT45S", contentRating: {} } }),
    video(ids[7], "Dumbbell Row Injury Rehab Tutorial"),
    video(ids[8], "Dumbbell Row Product Review Tutorial"),
    video(ids[9], "Barbell Row Tutorial"),
  ];
  const fetcher = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({ items: ids.map(id) }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ items }), { status: 200 }));
  await expect(createYouTubeTutorialClient({ apiKey: "key", fetcher }).findTutorial("Dumbbell Row")).resolves.toBeNull();
});
