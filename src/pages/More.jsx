import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { downloadBackup } from '../lib/backup'

// Phone-only overflow menu for pages that don't fit in the tab bar.
export default function More({ user }) {
  const [busy, setBusy] = useState(false)
  return (
    <section className="narrow">
      <div className="page-head">
        <h1>More</h1>
      </div>
      <ul className="more-list card">
        <li>
          <Link to="/journal">Journal</Link>
        </li>
        <li>
          <Link to="/protein">Protein</Link>
        </li>
        <li>
          <Link to="/goals">Goals</Link>
        </li>
        <li>
          <Link to="/analytics">Analytics</Link>
        </li>
        <li>
          <Link to="/habits/manage">Edit habits</Link>
        </li>
      </ul>
      <ul className="more-list card">
        <li>
          <button
            onClick={async () => {
              setBusy(true)
              await downloadBackup()
              setBusy(false)
            }}
            disabled={busy}
          >
            {busy ? 'Exporting…' : 'Download backup'}
          </button>
        </li>
        <li>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </li>
      </ul>
      <p className="muted small">Signed in as {user.email}</p>
    </section>
  )
}
