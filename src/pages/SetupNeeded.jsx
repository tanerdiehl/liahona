export default function SetupNeeded() {
  return (
    <div className="auth">
      <div className="auth-card">
        <h1 className="brand">Liahona</h1>
        <p>Supabase isn't connected yet.</p>
        <p className="muted">
          Copy <code>.env.example</code> to <code>.env.local</code>, fill in your project URL and key, then restart the
          dev server. See <code>README.md</code> for the full setup.
        </p>
      </div>
    </div>
  )
}
