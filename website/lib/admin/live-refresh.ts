export type LiveRefreshState<T> = { snapshot: T; stale: boolean; refreshing: boolean; lastErrorAt: string | null };
export function createLiveRefreshController<T>(input: { initial: T; load: (signal: AbortSignal) => Promise<T>; publish: (state: LiveRefreshState<T>) => void }) {
  let snapshot = input.initial; let controller: AbortController | null = null; let disposed = false;
  const publish = (state: Omit<LiveRefreshState<T>, "snapshot">) => { if (!disposed) input.publish({ snapshot, ...state }); };
  return {
    async refresh() { controller?.abort(); controller = new AbortController(); publish({ stale: false, refreshing: true, lastErrorAt: null }); try { snapshot = await input.load(controller.signal); publish({ stale: false, refreshing: false, lastErrorAt: null }); return true; } catch (error) { if ((error as Error).name === "AbortError") return false; publish({ stale: true, refreshing: false, lastErrorAt: new Date().toISOString() }); return false; } },
    dispose() { disposed = true; controller?.abort(); },
  };
}
