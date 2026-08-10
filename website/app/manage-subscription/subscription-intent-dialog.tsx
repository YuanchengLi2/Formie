"use client";

import { useState } from "react";

import {
  cancellationReasons,
  type CancellationReason,
  type SubscriptionIntentAction,
} from "@/lib/subscription-intent";

export type SubscriptionExecutionResult = "completed" | "native_app_opened" | "continue_on_iphone";

function formatPaidThrough(value: string | null | undefined): string {
  if (!value) return "the end of your paid period";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "the end of your paid period";
  const formattedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  const formattedTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: "UTC" }).format(date);
  return `${formattedDate} at ${formattedTime}`;
}

export function NativeSubscriptionHandoff({
  outcome,
  action = "cancel",
  onClose,
}: {
  outcome: "native_app_opened" | "continue_on_iphone";
  action?: SubscriptionIntentAction;
  onClose: () => void;
}) {
  const change = action === "cancel" ? "cancellation" : "resubscription";

  if (outcome === "continue_on_iphone") {
    return <>
      <h2 id="subscription-intent-title">Continue on your iPhone</h2>
      <p id="subscription-intent-detail">Apple sandbox subscriptions can only be changed on an iPhone or iPad using the Sandbox Apple Account that made the purchase. Open this page in Safari on that device, sign in to Formie, and repeat the {change} flow. Formie will then open Apple&apos;s native subscription sheet.</p>
      <div className="subscription-intent-actions subscription-intent-single-action">
        <button type="button" className="subscription-intent-secondary" onClick={onClose}>Close</button>
      </div>
    </>;
  }

  return <>
    <h2 id="subscription-intent-title">Formie should be opening</h2>
    <p id="subscription-intent-detail">Complete the {change} in Apple&apos;s native subscription sheet. Formie will update only after Apple confirms the change.</p>
    <div className="subscription-intent-actions">
      <button type="button" className="subscription-intent-secondary" onClick={onClose}>Close</button>
      <a className="subscription-intent-primary" href="form://account/manage-subscription">Open Formie again</a>
    </div>
  </>;
}

export function SubscriptionIntentDialog({
  visible,
  action,
  provider,
  paidThrough,
  opensNativeApp = false,
  onClose,
  onExecute,
}: {
  visible: boolean;
  action: SubscriptionIntentAction;
  provider?: string;
  paidThrough?: string | null;
  opensNativeApp?: boolean;
  onClose: () => void;
  onExecute: (reason?: CancellationReason) => Promise<SubscriptionExecutionResult | void>;
}) {
  const [stage, setStage] = useState<"confirm" | "reason" | "executing" | "error" | "native_app_opened" | "continue_on_iphone">("confirm");
  const [reason, setReason] = useState<CancellationReason | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const run = async (selectedReason?: CancellationReason) => {
    setStage("executing");
    setError(null);
    try {
      const outcome = await onExecute(selectedReason);
      if (outcome === "native_app_opened" || outcome === "continue_on_iphone") {
        setStage(outcome);
        return;
      }
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
        {stage === "native_app_opened" || stage === "continue_on_iphone" ? (
          <NativeSubscriptionHandoff outcome={stage} action={action} onClose={onClose} />
        ) : <>
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
              <button type="button" className="subscription-intent-primary subscription-intent-cancel" disabled={!reason} onClick={confirm}>{opensNativeApp ? "Open Formie" : `Continue to ${provider ?? "provider"}`}</button>
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
          <p id="subscription-intent-detail" className="subscription-intent-progress">{opensNativeApp ? "Opening Formie..." : `Opening ${provider ?? "subscription settings"}...`}</p>
        ) : (
          <>
            <p id="subscription-intent-detail">
              {opensNativeApp
                ? `This opens Formie, where Apple's native subscription sheet can use the Sandbox Apple Account that made the purchase. Formie changes the subscription state only after Apple confirms it. Your current balance remains unchanged through ${formatPaidThrough(paidThrough)}.`
                : action === "cancel"
                ? `Canceling in ${provider ?? "your subscription provider"} turns automatic renewal off. You keep Formie Pro through ${formatPaidThrough(paidThrough)}. It does not reset or remove your current analysis balance. Formie updates only after the provider confirms the change.`
                : provider
                  ? `Resuming turns automatic renewal back on. It does not reset or refill your current analysis balance or start a new paid period today. This opens ${provider} subscription settings so you can restore renewal after your current paid period ends.`
                  : `Resuming turns automatic renewal back on. It does not reset or refill your current analysis balance or start a new paid period today. Your current paid period remains through ${formatPaidThrough(paidThrough)}.`}
            </p>
            <div className="subscription-intent-actions">
              <button type="button" className="subscription-intent-secondary" onClick={onClose}>{action === "cancel" ? "No, keep subscription" : "Not now"}</button>
              <button type="button" className="subscription-intent-primary subscription-intent-cancel" onClick={confirm}>{action === "cancel" ? "Continue" : opensNativeApp ? "Open Formie" : `Continue to ${provider ?? "provider"}`}</button>
            </div>
          </>
        )}
        </>}
      </section>
    </div>
  );
}
