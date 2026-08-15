import { listUserObjectPaths, removeUserObjects, type StorageListEntry } from "./storage";

describe("account deletion storage", () => {
  it("recursively lists nested user files without returning folders", async () => {
    const pages: Record<string, StorageListEntry[]> = {
      "user-1": [
        { name: "session-a", id: null, metadata: null },
        { name: "root.mp4", id: "file-1", metadata: {} },
      ],
      "user-1/session-a": [
        { name: "keyframes", id: null, metadata: null },
        { name: "input.mp4", id: "file-2", metadata: {} },
      ],
      "user-1/session-a/keyframes": [
        { name: "00.jpg", id: "file-3", metadata: {} },
      ],
    };

    const paths = await listUserObjectPaths("analysis-videos", "user-1", async (_bucket, prefix, offset) => (
      offset === 0 ? pages[prefix] ?? [] : []
    ));

    expect(paths).toEqual([
      "user-1/root.mp4",
      "user-1/session-a/input.mp4",
      "user-1/session-a/keyframes/00.jpg",
    ]);
  });

  it("paginates a folder until the final short page", async () => {
    const offsets: number[] = [];
    const paths = await listUserObjectPaths("analysis-artifacts", "user-1", async (_bucket, _prefix, offset) => {
      offsets.push(offset);
      if (offset === 0) {
        return Array.from({ length: 100 }, (_, index) => ({ name: `file-${index}.json`, id: `id-${index}`, metadata: {} }));
      }
      return [{ name: "file-100.json", id: "id-100", metadata: {} }];
    });

    expect(offsets).toEqual([0, 100]);
    expect(paths).toHaveLength(101);
    expect(paths).toContain("user-1/file-100.json");
  });

  it.each(["", ".", "..", "../other.mp4", "nested/file.mp4", "nested\\file.mp4"])(
    "rejects unsafe storage entry %p instead of reporting complete deletion",
    async (name) => {
      await expect(listUserObjectPaths("analysis-videos", "user-1", async () => [
        { name, id: "file-1", metadata: {} },
      ])).rejects.toThrow("UNSAFE_STORAGE_PATH");
    },
  );

  it("rejects paths outside the exact authenticated user prefix", async () => {
    await expect(removeUserObjects(
      "analysis-videos",
      "user-1",
      ["user-10/session/video.mp4"],
      async () => undefined,
    )).rejects.toThrow("UNSAFE_STORAGE_PATH");
  });

  it("removes validated paths in batches of at most 100", async () => {
    const batches: string[][] = [];
    const paths = Array.from({ length: 205 }, (_, index) => `user-1/session/file-${index}.mp4`);

    await removeUserObjects("analysis-videos", "user-1", paths, async (_bucket, batch) => {
      batches.push(batch);
    });

    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5]);
    expect(batches.flat()).toEqual(paths);
  });
});
