const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
export const YOUTUBE_TUTORIAL_ELIGIBILITY_VERSION = "youtube-tutorial-v2";
const MIN_TUTORIAL_DURATION_SECONDS = 181;

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type TutorialVideo = {
  source: "youtube_data_api_v3";
  videoId: string;
  url: string;
  title: string;
  channel: string;
  channelId: string;
  thumbnailUrl: string;
  durationSeconds: number;
  verifiedAt: string;
  eligibilityVersion: string;
};

type Candidate = {
  id: string;
  searchIndex: number;
  title: string;
  channel: string;
  channelId: string;
  thumbnailUrl: string;
  durationSeconds: number;
};

function parseDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 86_400 + Number(match[2] ?? 0) * 3_600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
  return Number.isFinite(seconds) ? seconds : null;
}

function words(value: string): string[] {
  return value.toLowerCase().replace(/&amp;/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean).map((word) => word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word);
}

const weakWords = new Set(["a", "an", "and", "the", "how", "to", "do", "proper", "correct", "form", "tutorial", "guide", "exercise"]);
const variationWords = ["barbell", "dumbbell", "kettlebell", "cable", "machine", "smith", "incline", "decline", "seated", "standing", "sumo", "romanian"];
const rejectedPhrases = ["#shorts", "shorts", "compilation", "workout", "rehab", "rehabilitation", "physical therapy", "therapist", "injury", "pain relief", "medical", "sponsored", "promotion", "giveaway", "product review", "buy now", "top 10"];

function titleMatchesExercise(title: string, canonicalExercise: string): boolean {
  const canonical = words(canonicalExercise).filter((word) => !weakWords.has(word));
  const titleWords = new Set(words(title));
  if (!canonical.length || !canonical.every((word) => titleWords.has(word))) return false;
  const canonicalSet = new Set(canonical);
  return !variationWords.some((variation) => titleWords.has(variation) && !canonicalSet.has(variation));
}

function score(candidate: Candidate, canonicalExercise: string): number {
  const normalizedTitle = words(candidate.title).join(" ");
  const normalizedExercise = words(canonicalExercise).join(" ");
  const exact = normalizedTitle === normalizedExercise ? 10_000 : 0;
  const starts = normalizedTitle.startsWith(normalizedExercise) ? 2_000 : 0;
  const tutorial = /tutorial|how to|technique|form/i.test(candidate.title) ? 400 : 0;
  const duration = Math.max(0, 600 - Math.abs(candidate.durationSeconds - 360));
  return exact + starts + tutorial + duration - candidate.searchIndex;
}

export function createYouTubeTutorialClient({ apiKey, fetcher = fetch, now = () => new Date() }: { apiKey: string; fetcher?: Fetcher; now?: () => Date }) {
  if (!apiKey) throw new Error("YOUTUBE_DATA_API_KEY is required");
  const request = async (path: string, parameters: Record<string, string>) => {
    const url = new URL(`${YOUTUBE_API}/${path}`);
    Object.entries({ ...parameters, key: apiKey }).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`YouTube Data API failed: ${response.status}`);
    return await response.json() as Record<string, unknown>;
  };

  return {
    async findTutorial(canonicalExercise: string): Promise<TutorialVideo | null> {
      const exercise = canonicalExercise.trim();
      if (!exercise) return null;
      const search = await request("search", {
        part: "snippet",
        q: exercise,
        type: "video",
        maxResults: "12",
        safeSearch: "strict",
        videoEmbeddable: "true",
        regionCode: "US",
        relevanceLanguage: "en",
      });
      const searchItems = Array.isArray(search.items) ? search.items : [];
      const ids = searchItems.map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).id : null).map((id) => id && typeof id === "object" ? (id as Record<string, unknown>).videoId : null).filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id));
      if (!ids.length) return null;
      const videos = await request("videos", { part: "snippet,contentDetails,status", id: ids.join(",") });
      const searchOrder = new Map(ids.map((id, index) => [id, index]));
      const candidates = (Array.isArray(videos.items) ? videos.items : []).flatMap((raw): Candidate[] => {
        if (!raw || typeof raw !== "object") return [];
        const item = raw as Record<string, unknown>;
        const id = typeof item.id === "string" ? item.id : "";
        const snippet = item.snippet && typeof item.snippet === "object" ? item.snippet as Record<string, unknown> : {};
        const details = item.contentDetails && typeof item.contentDetails === "object" ? item.contentDetails as Record<string, unknown> : {};
        const status = item.status && typeof item.status === "object" ? item.status as Record<string, unknown> : {};
        const rating = details.contentRating && typeof details.contentRating === "object" ? details.contentRating as Record<string, unknown> : {};
        const title = typeof snippet.title === "string" ? snippet.title : "";
        const description = typeof snippet.description === "string" ? snippet.description : "";
        const durationSeconds = parseDurationSeconds(details.duration);
        const combined = `${title} ${description}`.toLowerCase();
        // YouTube currently classifies square or vertical videos up to three
        // minutes as Shorts, but Data API v3 exposes no authoritative Shorts
        // flag. Excluding every video at or below that boundary fails closed.
        if (!id || durationSeconds === null || durationSeconds < MIN_TUTORIAL_DURATION_SECONDS || durationSeconds > 1_200) return [];
        if (status.privacyStatus !== "public" || status.uploadStatus !== "processed" || status.embeddable !== true) return [];
        if (snippet.liveBroadcastContent !== "none" || rating.ytRating === "ytAgeRestricted") return [];
        if (rejectedPhrases.some((phrase) => combined.includes(phrase)) || !titleMatchesExercise(title, exercise)) return [];
        const thumbnails = snippet.thumbnails && typeof snippet.thumbnails === "object" ? snippet.thumbnails as Record<string, unknown> : {};
        const image = (thumbnails.maxres ?? thumbnails.high ?? thumbnails.medium ?? thumbnails.default) as Record<string, unknown> | undefined;
        const thumbnailUrl = typeof image?.url === "string" ? image.url : "";
        const channel = typeof snippet.channelTitle === "string" ? snippet.channelTitle : "";
        const channelId = typeof snippet.channelId === "string" ? snippet.channelId : "";
        if (!thumbnailUrl || !channel || !channelId) return [];
        return [{ id, searchIndex: searchOrder.get(id) ?? 999, title, channel, channelId, thumbnailUrl, durationSeconds }];
      });
      const selected = candidates.sort((left, right) => score(right, exercise) - score(left, exercise) || left.id.localeCompare(right.id))[0];
      if (!selected) return null;
      return { source: "youtube_data_api_v3", videoId: selected.id, url: `https://www.youtube.com/watch?v=${selected.id}`, title: selected.title, channel: selected.channel, channelId: selected.channelId, thumbnailUrl: selected.thumbnailUrl, durationSeconds: selected.durationSeconds, verifiedAt: now().toISOString(), eligibilityVersion: YOUTUBE_TUTORIAL_ELIGIBILITY_VERSION };
    },
  };
}
