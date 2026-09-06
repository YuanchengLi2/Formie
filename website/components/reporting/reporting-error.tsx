"use client";

export default function ReportingError({ reset }: { reset: () => void }) {
  return <main style={{ padding: "48px 24px", maxWidth: 640, margin: "0 auto" }}>
    <h1>Reporting could not be loaded</h1>
    <p>Your data is still saved. Try loading this page again.</p>
    <button type="button" onClick={reset}>Try again</button>
    <p><a href="/">Return home</a></p>
  </main>;
}
