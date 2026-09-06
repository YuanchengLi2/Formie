let activeFlowId: string | null = null;

function newFlowId(): string {
  return globalThis.crypto?.randomUUID?.() ?? "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export function startCaptureFlow(): string {
  activeFlowId = newFlowId();
  return activeFlowId;
}

export function currentCaptureFlow(): string {
  activeFlowId ??= newFlowId();
  return activeFlowId;
}

export function finishCaptureFlow(): void {
  activeFlowId = null;
}
