import type { RecordedSet } from "./types";
import {
  createDeviceVideoStore,
  type DeviceVideoStoreAdapter,
} from "./device-video-store";

const recording: RecordedSet = {
  localUri: "file:///camera-cache/set.mp4",
  durationMs: 12_000,
  mimeType: "video/mp4",
};

function adapter(): DeviceVideoStoreAdapter {
  let bindings: Record<string, RecordedSet> = {};
  return {
    copyIntoLibrary: jest.fn(async (source) => ({
      ...source,
      localUri: "file:///documents/formie-recordings/device-copy.mp4",
    })),
    readBindings: jest.fn(async () => bindings),
    writeBindings: jest.fn(async (next) => {
      bindings = next;
    }),
    exists: jest.fn(async () => true),
  };
}

describe("device video store", () => {
  it("copies camera output into durable device storage before analysis", async () => {
    const storage = adapter();
    const store = createDeviceVideoStore(storage);

    await expect(store.persist(recording)).resolves.toEqual({
      ...recording,
      localUri: "file:///documents/formie-recordings/device-copy.mp4",
    });
    expect(storage.copyIntoLibrary).toHaveBeenCalledWith(recording);
  });

  it("binds the device copy to its analysis and resolves it after restart", async () => {
    const storage = adapter();
    const store = createDeviceVideoStore(storage);
    const saved = await store.persist(recording);
    await store.bind("session-1", saved);

    await expect(createDeviceVideoStore(storage).find("session-1")).resolves.toEqual(saved);
  });

  it("drops stale bindings when the device file no longer exists", async () => {
    const storage = adapter();
    const store = createDeviceVideoStore(storage);
    const saved = await store.persist(recording);
    await store.bind("session-1", saved);
    (storage.exists as jest.Mock).mockResolvedValue(false);

    await expect(store.find("session-1")).resolves.toBeNull();
    expect(storage.writeBindings).toHaveBeenLastCalledWith({});
  });
});
