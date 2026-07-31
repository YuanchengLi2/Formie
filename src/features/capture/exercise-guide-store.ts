import { Directory, File, Paths } from "expo-file-system";

import {
  exerciseGuideSchema,
  type ExerciseGuide,
} from "@/features/analysis/api";
import { getCaptureExerciseGuideKey } from "./exercise-guide-key";

const CACHE_VERSION = 1;
const MAX_GUIDES = 50;

type StoredGuideEntry = {
  guide: ExerciseGuide;
  updatedAt: number;
};

type StoredGuideCache = {
  version: typeof CACHE_VERSION;
  entries: Record<string, StoredGuideEntry>;
};

export type ExerciseGuideStoreAdapter = {
  read: () => Promise<unknown>;
  write: (cache: StoredGuideCache) => Promise<void>;
};

function expectedKey(guide: ExerciseGuide): string | null {
  return getCaptureExerciseGuideKey(
    guide.exercise.catalogExerciseId
      ? {
          kind: "selected",
          catalogExerciseId: guide.exercise.catalogExerciseId,
          canonicalName: guide.exercise.canonicalName,
          mechanics: {},
        }
      : {
          kind: "custom",
          canonicalName: guide.exercise.canonicalName,
        },
  );
}

function validCache(value: unknown): StoredGuideCache {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || (value as { version?: unknown }).version !== CACHE_VERSION
  ) {
    return { version: CACHE_VERSION, entries: {} };
  }

  const rawEntries = (value as { entries?: unknown }).entries;
  if (!rawEntries || typeof rawEntries !== "object" || Array.isArray(rawEntries)) {
    return { version: CACHE_VERSION, entries: {} };
  }

  const entries = Object.fromEntries(
    Object.entries(rawEntries).flatMap(([key, rawEntry]) => {
      if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) return [];
      const updatedAt = (rawEntry as { updatedAt?: unknown }).updatedAt;
      const parsed = exerciseGuideSchema.safeParse((rawEntry as { guide?: unknown }).guide);
      if (!parsed.success || typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return [];
      if (expectedKey(parsed.data) !== key) return [];
      return [[key, { guide: parsed.data, updatedAt } satisfies StoredGuideEntry]];
    }),
  );

  return { version: CACHE_VERSION, entries };
}

export function createExerciseGuideStore(adapter: ExerciseGuideStoreAdapter) {
  return {
    find: async (key: string): Promise<ExerciseGuide | null> => {
      const cache = validCache(await adapter.read());
      return cache.entries[key]?.guide ?? null;
    },
    save: async (key: string, guide: ExerciseGuide): Promise<void> => {
      if (expectedKey(guide) !== key) return;
      const cache = validCache(await adapter.read());
      const entries = {
        ...cache.entries,
        [key]: { guide, updatedAt: Date.now() },
      };
      const retainedEntries = Object.fromEntries(
        Object.entries(entries)
          .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
          .slice(0, MAX_GUIDES),
      );
      await adapter.write({ version: CACHE_VERSION, entries: retainedEntries });
    },
  };
}

function createNativeExerciseGuideStore() {
  const guideDirectory = new Directory(Paths.document, "formie-guides");
  const guideFile = new File(guideDirectory, "guides.json");
  const ensureDirectory = () => guideDirectory.create({ idempotent: true, intermediates: true });

  return createExerciseGuideStore({
    read: async () => {
      ensureDirectory();
      if (!guideFile.exists) return null;
      try {
        return JSON.parse(await guideFile.text());
      } catch {
        return null;
      }
    },
    write: async (cache) => {
      ensureDirectory();
      if (!guideFile.exists) guideFile.create({ intermediates: true });
      guideFile.write(JSON.stringify(cache));
    },
  });
}

let nativeStore: ReturnType<typeof createExerciseGuideStore> | null = null;

function getNativeStore() {
  nativeStore ??= createNativeExerciseGuideStore();
  return nativeStore;
}

export const exerciseGuideStore = {
  find: (key: string) => getNativeStore().find(key),
  save: (key: string, guide: ExerciseGuide) => getNativeStore().save(key, guide),
};
