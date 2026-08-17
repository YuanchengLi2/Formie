type BeforeRemoveEvent = {
  data: { action: { type: string } };
  preventDefault: () => void;
};

const backActions = new Set(["GO_BACK", "POP", "POP_TO_TOP"]);

export function createResultsExitHandler(dismissToHome: () => void) {
  let redirecting = false;
  return (event: BeforeRemoveEvent) => {
    if (redirecting || !backActions.has(event.data.action.type)) return;
    redirecting = true;
    event.preventDefault();
    dismissToHome();
  };
}
