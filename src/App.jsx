import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { isConfigured, supabase } from './lib/supabase'
import Login from './pages/Login'
import SetupNeeded from './pages/SetupNeeded'
import Layout from './components/Layout'
import Habits from './pages/Habits'
import ManageHabits from './pages/ManageHabits'
import Protein from './pages/Protein'

export default function App() {
  // undefined = still checking stored session, null = signed out
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isConfigured) return <SetupNeeded />
  if (session === undefined) return <div className="splash">Liahona</div>
  if (!session) return <Login />

  // HashRouter (#/habits) works on GitHub Pages without server rewrites.
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout user={session.user} />}>
          <Route index element={<Navigate to="/habits" replace />} />
          <Route path="habits" element={<Habits user={session.user} />} />
          <Route path="habits/manage" element={<ManageHabits />} />
          <Route path="protein" element={<Protein />} />
          <Route path="*" element={<Navigate to="/habits" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
