export const accountStorageBuckets = ["analysis-videos", "analysis-artifacts"] as const;
export type AccountStorageBucket = typeof accountStorageBuckets[number];

export type StorageListEntry = {
  name: string;
  id: string | null;
  metadata: Record<string, unknown> | null;
};

export type StoragePageLoader = (
  bucket: AccountStorageBucket,
  prefix: string,
  offset: number,
  limit: number,
) => Promise<StorageListEntry[]>;

const LIST_PAGE_SIZE = 100;
const REMOVE_BATCH_SIZE = 100;

function assertSafeSegment(value: string): void {
  if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\")) {
    throw new Error("UNSAFE_STORAGE_PATH");
  }
}

function appendSafeSegment(prefix: string, name: string): string {
  assertSafeSegment(name);
  return `${prefix}/${name}`;
}

function assertOwnedPath(userId: string, path: string): void {
  assertSafeSegment(userId);
  const segments = path.split("/");
  if (segments[0] !== userId || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))) {
    throw new Error("UNSAFE_STORAGE_PATH");
  }
}

export async function listUserObjectPaths(
  bucket: AccountStorageBucket,
  userId: string,
  loadPage: StoragePageLoader,
): Promise<string[]> {
  assertSafeSegment(userId);
  const files: string[] = [];
  const pendingPrefixes = [userId];
  const visitedPrefixes = new Set<string>();

  while (pendingPrefixes.length > 0) {
    const prefix = pendingPrefixes.shift();
    if (!prefix || visitedPrefixes.has(prefix)) continue;
    assertOwnedPath(userId, prefix);
    visitedPrefixes.add(prefix);

    for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      const entries = await loadPage(bucket, prefix, offset, LIST_PAGE_SIZE);
      for (const entry of entries) {
        const path = appendSafeSegment(prefix, entry.name);
        assertOwnedPath(userId, path);
        if (entry.id === null && entry.metadata === null) pendingPrefixes.push(path);
        else files.push(path);
      }
      if (entries.length < LIST_PAGE_SIZE) break;
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export async function removeUserObjects(
  bucket: AccountStorageBucket,
  userId: string,
  paths: string[],
  removeBatch: (bucket: AccountStorageBucket, paths: string[]) => Promise<void>,
): Promise<void> {
  assertSafeSegment(userId);
  paths.forEach((path) => assertOwnedPath(userId, path));
  for (let index = 0; index < paths.length; index += REMOVE_BATCH_SIZE) {
    await removeBatch(bucket, paths.slice(index, index + REMOVE_BATCH_SIZE));
  }
}
