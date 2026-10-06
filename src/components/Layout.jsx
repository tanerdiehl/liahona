import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSaveStatus } from '../lib/saveStatus'
import { downloadBackup } from '../lib/backup'
import Toaster from './Toaster'
import ActiveWorkoutBar from '../workout/ActiveWorkoutBar'
import RestTimerBar from '../workout/RestTimerBar'

// Desktop top nav shows everything; the phone tab bar keeps the daily
// essentials and tucks the rest under "More".
const NAV = [
  { to: '/', label: 'Today', end: true },
  { to: '/habits', label: 'Habits' },
  { to: '/workout', label: 'Workout' },
  { to: '/body', label: 'Body' },
  { to: '/protein', label: 'Protein' },
  { to: '/todo', label: 'To-do' },
  { to: '/goals', label: 'Goals' },
  { to: '/journal', label: 'Journal' },
  { to: '/analytics', label: 'Analytics' },
]
const TABS = [
  { to: '/', label: 'Today', icon: '☼', end: true },
  { to: '/habits', label: 'Habits', icon: '◎' },
  { to: '/workout', label: 'Workout', icon: '◈' },
  { to: '/todo', label: 'To-do', icon: '☐' },
  { to: '/more', label: 'More', icon: '⋯', also: ['/body', '/photos', '/data', '/protein', '/goals', '/journal', '/analytics', '/habits/manage'] },
]

export default function Layout({ user }) {
  const [backingUp, setBackingUp] = useState(false)
  const { pathname } = useLocation()

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
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <SaveIndicator />
        <NavLink to="/data" className="link-btn desktop-only" title="Export or import your data">
          Data
        </NavLink>
        <button className="link-btn desktop-only" title={user.email} onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      <Toaster />
      <main className="content">
        <ActiveWorkoutBar />
        <Outlet />
      </main>

      <RestTimerBar />

      <nav className="tabbar">
        {TABS.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              isActive || n.also?.some((p) => pathname === p || pathname.startsWith(p + '/')) ? 'active' : ''
            }
          >
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
