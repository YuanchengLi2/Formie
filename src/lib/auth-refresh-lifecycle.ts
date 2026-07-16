type RefreshSubscription = { remove: () => void };

type AuthRefreshLifecycleOptions = {
  platform: string;
  currentState: string;
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
  addListener: (listener: (state: string) => void) => RefreshSubscription;
};

function run(operation: () => void | Promise<void>) {
  void Promise.resolve(operation()).catch(() => undefined);
}

export function bindAuthRefreshLifecycle(options: AuthRefreshLifecycleOptions): () => void {
  if (options.platform === "web") return () => undefined;

  let currentState = options.currentState;
  const update = (nextState: string) => {
    if (nextState === currentState) return;
    currentState = nextState;
    run(nextState === "active" ? options.start : options.stop);
  };

  run(currentState === "active" ? options.start : options.stop);
  const subscription = options.addListener(update);

  return () => {
    subscription.remove();
    run(options.stop);
  };
}
