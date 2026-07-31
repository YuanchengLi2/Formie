import { Directory, File, Paths } from "expo-file-system";

import type { RecordedSet } from "./types";

export type DeviceVideoStoreAdapter = {
  copyIntoLibrary: (recording: RecordedSet) => Promise<RecordedSet>;
  readBindings: () => Promise<Record<string, RecordedSet>>;
  writeBindings: (bindings: Record<string, RecordedSet>) => Promise<void>;
  exists: (uri: string) => Promise<boolean>;
};

export function createDeviceVideoStore(adapter: DeviceVideoStoreAdapter) {
  return {
    persist: (recording: RecordedSet) => adapter.copyIntoLibrary(recording),
    bind: async (sessionId: string, recording: RecordedSet) => {
      const bindings = await adapter.readBindings();
      await adapter.writeBindings({ ...bindings, [sessionId]: recording });
    },
    find: async (sessionId: string): Promise<RecordedSet | null> => {
      const bindings = await adapter.readBindings();
      const recording = bindings[sessionId];
      if (!recording) return null;
      if (await adapter.exists(recording.localUri)) return recording;
      const { [sessionId]: _stale, ...current } = bindings;
      await adapter.writeBindings(current);
      return null;
    },
  };
}

function validBindings(value: unknown): Record<string, RecordedSet> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => (
    item
    && typeof item === "object"
    && !Array.isArray(item)
    && typeof (item as RecordedSet).localUri === "string"
    && Number.isInteger((item as RecordedSet).durationMs)
    && typeof (item as RecordedSet).mimeType === "string"
  ))) as Record<string, RecordedSet>;
}

function createNativeDeviceVideoStore() {
  const recordingsDirectory = new Directory(Paths.document, "formie-recordings");
  const bindingsFile = new File(recordingsDirectory, "recordings.json");
  const ensureLibrary = () => recordingsDirectory.create({ idempotent: true, intermediates: true });
  return createDeviceVideoStore({
    copyIntoLibrary: async (recording) => {
      ensureLibrary();
      if (recording.localUri.startsWith(recordingsDirectory.uri)) return recording;
      const id = globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const destination = new File(recordingsDirectory, `${id}.mp4`);
      new File(recording.localUri).copy(destination);
      return { ...recording, localUri: destination.uri };
    },
    readBindings: async () => {
      ensureLibrary();
      if (!bindingsFile.exists) return {};
      try {
        return validBindings(JSON.parse(await bindingsFile.text()));
      } catch {
        return {};
      }
    },
    writeBindings: async (bindings) => {
      ensureLibrary();
      if (!bindingsFile.exists) bindingsFile.create({ intermediates: true });
      bindingsFile.write(JSON.stringify(bindings));
    },
    exists: async (uri) => new File(uri).exists,
  });
}

let nativeStore: ReturnType<typeof createDeviceVideoStore> | null = null;
function getNativeStore() {
  nativeStore ??= createNativeDeviceVideoStore();
  return nativeStore;
}

export const deviceVideoStore = {
  persist: (recording: RecordedSet) => getNativeStore().persist(recording),
  bind: (sessionId: string, recording: RecordedSet) => getNativeStore().bind(sessionId, recording),
  find: (sessionId: string) => getNativeStore().find(sessionId),
};
