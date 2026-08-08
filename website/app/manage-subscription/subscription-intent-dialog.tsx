"use client";

import { useState } from "react";

import {
  cancellationReasons,
  type CancellationReason,
  type SubscriptionIntentAction,
} from "@/lib/subscription-intent";

export function SubscriptionIntentDialog({
  visible,
  action,
  provider,
  onClose,
  onExecute,
}: {
  visible: boolean;
  action: SubscriptionIntentAction;
  provider?: string;
  onClose: () => void;
  onExecute: (reason?: CancellationReason) => Promise<void>;
}) {
  const [stage, setStage] = useState<"confirm" | "reason" | "executing" | "error">("confirm");
  const [reason, setReason] = useState<CancellationReason | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const run = async (selectedReason?: CancellationReason) => {
    setStage("executing");
    setError(null);
    try {
      await onExecute(selectedReason);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The subscription change could not be completed.");
      setStage("error");
    }
  };

  const confirm = () => {
    if (action === "cancel" && stage === "confirm") {
      setStage("reason");
      return;
    }
    if (stage === "reason" && reason) void run(reason);
    if (action === "resume" && stage === "confirm") void run();
  };

  const title = stage === "reason"
    ? "Why are you cancelling?"
    : action === "cancel"
      ? "Are you sure you want to cancel your subscription?"
      : "Are you sure you want to resubscribe?";

  return (
    <div className="subscription-intent-backdrop" role="presentation" tabIndex={-1} onKeyDown={(event) => { if (event.key === "Escape" && stage !== "executing") onClose(); }}>
      <section className="subscription-intent-dialog" role="dialog" aria-modal="true" aria-labelledby="subscription-intent-title" aria-describedby="subscription-intent-detail">
        <span className="portal-kicker">SUBSCRIPTION</span>
        <h2 id="subscription-intent-title">{title}</h2>
        {stage === "reason" ? (
          <>
            <p id="subscription-intent-detail">Your feedback helps us improve Formie. You keep your current access through the paid period.</p>
            <div className="subscription-intent-reasons" role="group" aria-label="Cancellation reason">
              {cancellationReasons.map((item) => (
                <button
                  type="button"
                  className={"subscription-intent-reason" + (reason === item.value ? " selected" : "")}
                  aria-pressed={reason === item.value}
                  key={item.value}
                  onClick={() => setReason(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="subscription-intent-actions">
              <button type="button" className="subscription-intent-secondary" onClick={() => setStage("confirm")}>Back</button>
              <button type="button" className="subscription-intent-primary subscription-intent-cancel" disabled={!reason} onClick={confirm}>Continue</button>
            </div>
          </>
        ) : stage === "error" ? (
          <>
            <p id="subscription-intent-detail">We could not update your subscription yet. Your current access is unchanged.</p>
            <p className="subscription-intent-error" role="alert">{error}</p>
            <div className="subscription-intent-actions">
              <button type="button" className="subscription-intent-secondary" onClick={onClose}>Close</button>
              <button type="button" className="subscription-intent-primary" onClick={() => setStage(action === "cancel" ? "reason" : "confirm")}>Try again</button>
            </div>
          </>
        ) : stage === "executing" ? (
          <p id="subscription-intent-detail" className="subscription-intent-progress">Updating your subscription...</p>
        ) : (
          <>
            <p id="subscription-intent-detail">
              {action === "cancel"
                ? "You keep Formie Pro and your current analysis balance until the end of your paid period. Cancellation stops the next renewal."
                : provider
                  ? "Your current paid period and analysis balance stay the same. This opens " + provider + " subscription settings so you can restore renewal after this paid period ends."
                  : "Your current paid period and analysis balance stay the same. Resubscribing enables renewal after this paid period ends."}
            </p>
            <div className="subscription-intent-actions">
              <button type="button" className="subscription-intent-secondary" onClick={onClose}>{action === "cancel" ? "No, keep subscription" : "Not now"}</button>
              <button type="button" className="subscription-intent-primary subscription-intent-cancel" onClick={confirm}>{action === "cancel" ? "Yes, cancel subscription" : "Yes, resubscribe"}</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
