import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/habits', label: 'Habits', icon: '◎' },
  { to: '/protein', label: 'Protein', icon: '◐' },
  { to: '/todo', label: 'To-do', icon: '☐' },
  { to: '/analytics', label: 'Analytics', icon: '▥' },
]

export default function Layout({ user }) {
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
