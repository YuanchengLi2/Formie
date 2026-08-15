export function AdminLoginForm({ error }: { error?: string }) {
  return (
    <main className="admin-login-shell">
      <section className="admin-login-card">
        <div className="admin-login-brand"><span className="admin-mark">F</span><b>Formie</b></div>
        <span className="admin-kicker">Founder access</span>
        <h1>Know what is actually happening.</h1>
        <p>Private production metrics for users, analyses, conversion, revenue, cost, and reliability.</p>
        <form action="/admin/sign-in" method="post" className="admin-login-form">
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          {error ? <div className="admin-login-error" role="alert">{error}</div> : null}
          <button type="submit">Sign in</button>
        </form>
        <small className="admin-login-note">Only the allowlisted founder account can access this dashboard.</small>
      </section>
    </main>
  );
}
