type AppStateSubscription = { remove: () => void };

export function bindAnalysisResume(input: {
  initialState: string;
  addListener: (listener: (state: string) => void) => AppStateSubscription;
  onActive: () => void;
}): () => void {
  let previousState = input.initialState;
  const subscription = input.addListener((nextState) => {
    const becameActive = nextState === "active" && previousState !== "active";
    previousState = nextState;
    if (becameActive) input.onActive();
  });
  return () => subscription.remove();
}
