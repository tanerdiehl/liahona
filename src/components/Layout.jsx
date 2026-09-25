import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSaveStatus } from '../lib/saveStatus'
import { downloadBackup } from '../lib/backup'

const NAV = [
  { to: '/habits', label: 'Habits', icon: '◎' },
  { to: '/protein', label: 'Protein', icon: '◐' },
  { to: '/todo', label: 'To-do', icon: '☐' },
  { to: '/analytics', label: 'Analytics', icon: '▥' },
]

export default function Layout({ user }) {
  const [backingUp, setBackingUp] = useState(false)

  async function backup() {
    setBackingUp(true)
    await downloadBackup()
    setBackingUp(false)
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Liahona</span>
        <nav className="topnav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <SaveIndicator />
        <button className="link-btn" onClick={backup} disabled={backingUp} title="Download all your data as a file">
          {backingUp ? 'Exporting…' : 'Backup'}
        </button>
        <button className="link-btn" title={user.email} onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to}>
            <span className="tab-icon" aria-hidden>
              {n.icon}
            </span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function SaveIndicator() {
  const { pending, error } = useSaveStatus()
  if (pending > 0) return <span className="save-status">Saving…</span>
  if (error)
    return (
      <span className="save-status bad" title={error}>
        ⚠ Not saved
      </span>
    )
  return <span className="save-status ok">✓ Saved</span>
}
