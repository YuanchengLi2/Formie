"use client";

import { useState } from "react";

import {
  cancellationReasons,
  type CancellationReason,
  type SubscriptionIntentAction,
} from "@/lib/subscription-intent";

function formatPaidThrough(value: string | null | undefined): string {
  if (!value) return "the end of your paid period";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "the end of your paid period";
  const formattedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  const formattedTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);
  return `${formattedDate} at ${formattedTime}`;
}

export function SubscriptionIntentDialog({
  visible,
  action,
  provider,
  paidThrough,
  onClose,
  onExecute,
}: {
  visible: boolean;
  action: SubscriptionIntentAction;
  provider?: string;
  paidThrough?: string | null;
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
            <p id="subscription-intent-detail">Your feedback helps us improve Formie. Canceling turns automatic renewal off, but you keep your current access through the paid period.</p>
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
                ? `Canceling turns automatic renewal off. You keep Formie Pro through ${formatPaidThrough(paidThrough)}. It does not reset or remove your current analysis balance.`
                : provider
                  ? `Resuming turns automatic renewal back on. It does not reset or refill your current analysis balance or start a new paid period today. This opens ${provider} subscription settings so you can restore renewal after your current paid period ends.`
                  : `Resuming turns automatic renewal back on. It does not reset or refill your current analysis balance or start a new paid period today. Your current paid period remains through ${formatPaidThrough(paidThrough)}.`}
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
