"use client";

import { FormEvent, useState } from "react";

type Submission = { submitted: true; requestId: string };

export function SupportForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    const form = new FormData(event.currentTarget);
    const body = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      category: String(form.get("category") ?? ""),
      message: String(form.get("message") ?? ""),
      website: String(form.get("website") ?? ""),
    };

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as Partial<Submission> & { message?: string };
      if (!response.ok || payload.submitted !== true || typeof payload.requestId !== "string") {
        throw new Error(payload.message || "Your request could not be sent. Please try again.");
      }
      setRequestId(payload.requestId);
      setStatus("submitted");
      event.currentTarget.reset();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Your request could not be sent.");
      setStatus("error");
    }
  }

  return (
    <form className="support-form" onSubmit={submit}>
      <div className="support-form-row">
        <label>
          Name <span>Optional</span>
          <input name="name" type="text" autoComplete="name" maxLength={100} />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
      </div>
      <label>
        What can we help with?
        <select name="category" required defaultValue="">
          <option value="" disabled>Choose a category</option>
          <option value="account">Account</option>
          <option value="billing">Billing</option>
          <option value="bug">Bug or technical issue</option>
          <option value="feature">Feature request</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label>
        Message
        <textarea name="message" minLength={20} maxLength={2000} rows={8} required />
        <span className="support-form-help">20–2,000 characters</span>
      </label>
      <label className="support-honeypot" aria-hidden="true">
        Website
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <button className="button" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send support request"}
      </button>
      <div className="support-form-status" aria-live="polite">
        {status === "submitted" ? (
          <p>Your request was sent. Request ID: <strong>{requestId}</strong></p>
        ) : null}
        {status === "error" ? <p className="support-form-error">{error}</p> : null}
      </div>
    </form>
  );
}
