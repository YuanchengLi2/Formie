const API = "https://generativelanguage.googleapis.com/v1beta";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type TutorialVideo = {
  videoId: string;
  url: string;
  title: string;
  channel: string;
  whyChosen: string;
  thumbnailUrl: string;
  searchAttributionHtml: string | null;
};

const TUTORIAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["videoId", "url", "whyChosen"],
  properties: {
    videoId: { type: "string" },
    url: { type: "string" },
    whyChosen: { type: "string" },
  },
} as const;

function responseText(payload: Record<string, unknown>): string {
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") throw new Error("Gemini returned no tutorial candidate");
  const content = (candidates[0] as Record<string, unknown>).content as Record<string, unknown> | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts)) throw new Error("Gemini returned no tutorial content");
  const text = parts.map((part) => part && typeof part === "object" ? (part as Record<string, unknown>).text : null).find((value) => typeof value === "string");
  if (typeof text !== "string") throw new Error("Gemini returned no tutorial JSON");
  return text;
}

function attributionHtml(payload: Record<string, unknown>): string | null {
  const candidate = Array.isArray(payload.candidates) ? payload.candidates[0] : null;
  if (!candidate || typeof candidate !== "object") return null;
  const metadata = (candidate as Record<string, unknown>).groundingMetadata as Record<string, unknown> | undefined;
  const entryPoint = metadata?.searchEntryPoint as Record<string, unknown> | undefined;
  return typeof entryPoint?.renderedContent === "string" ? entryPoint.renderedContent : null;
}

export function createGeminiTutorialClient({ apiKey, model, fetcher = fetch }: { apiKey: string; model: string; fetcher?: Fetcher }) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  if (!model) throw new Error("GEMINI_MODEL is required");

  return {
    async findTutorial(exerciseLabel: string): Promise<TutorialVideo | null> {
      const prompt = `Search the current web and select exactly one public YouTube technique tutorial for ${exerciseLabel}. Prefer a credible certified coach, physical therapist, or established evidence-based training channel. The video must clearly demonstrate setup, execution, and common mistakes. Reject Shorts, compilations, entertainment clips, injury rehabilitation, and product promotions. Return the direct youtube.com watch URL, its 11-character videoId, and one short reason it is useful for learning ${exerciseLabel}.`;
      const response = await fetcher(`${API}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { responseMimeType: "application/json", responseJsonSchema: TUTORIAL_SCHEMA },
        }),
      });
      if (!response.ok) throw new Error(`Gemini tutorial search failed: ${response.status}`);
      const payload = await response.json() as Record<string, unknown>;
      const selected = JSON.parse(responseText(payload)) as Record<string, unknown>;
      const videoId = typeof selected.videoId === "string" ? selected.videoId.trim() : "";
      const whyChosen = typeof selected.whyChosen === "string" ? selected.whyChosen.trim() : "";
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !whyChosen) return null;
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const verification = await fetcher(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (!verification.ok) return null;
      const verified = await verification.json() as Record<string, unknown>;
      if (typeof verified.title !== "string" || typeof verified.author_name !== "string") return null;
      return {
        videoId,
        url,
        title: verified.title,
        channel: verified.author_name,
        whyChosen,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        searchAttributionHtml: attributionHtml(payload),
      };
    },
  };
}
