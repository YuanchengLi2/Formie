import { createGeminiTutorialClient } from "./gemini-tutorial";

it("uses Gemini search and verifies the selected YouTube video before returning it", async () => {
  const fetcher = jest.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: JSON.stringify({ videoId: "abcdefghijk", url: "https://www.youtube.com/watch?v=abcdefghijk", whyChosen: "Clear technique instruction." }) }] },
        groundingMetadata: { searchEntryPoint: { renderedContent: "<div>Google Search</div>" } },
      }],
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ title: "Hammer Curl Tutorial", author_name: "Trusted Coach" }), { status: 200 }));

  const client = createGeminiTutorialClient({ apiKey: "key", model: "gemini-3.5-flash", fetcher });
  await expect(client.findTutorial("Hammer Curl")).resolves.toEqual({
    videoId: "abcdefghijk",
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    title: "Hammer Curl Tutorial",
    channel: "Trusted Coach",
    whyChosen: "Clear technique instruction.",
    thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
    searchAttributionHtml: "<div>Google Search</div>",
  });
  expect(JSON.parse(fetcher.mock.calls[0][1].body).tools).toEqual([{ google_search: {} }]);
  expect(fetcher.mock.calls[1][0]).toContain("youtube.com/oembed");
});

it("returns null when the selected YouTube video cannot be verified", async () => {
  const fetcher = jest.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ videoId: "abcdefghijk", url: "https://www.youtube.com/watch?v=abcdefghijk", whyChosen: "Clear." }) }] } }] }), { status: 200 }))
    .mockResolvedValueOnce(new Response("missing", { status: 404 }));
  const client = createGeminiTutorialClient({ apiKey: "key", model: "gemini-3.5-flash", fetcher });
  await expect(client.findTutorial("Hammer Curl")).resolves.toBeNull();
});
