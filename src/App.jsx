import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { isConfigured, supabase } from './lib/supabase'
import Login from './pages/Login'
import SetupNeeded from './pages/SetupNeeded'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Habits from './pages/Habits'
import ManageHabits from './pages/ManageHabits'
import Protein from './pages/Protein'
import Tasks from './pages/Tasks'
import Goals from './pages/Goals'
import GoalDetail from './pages/GoalDetail'
import Journal from './pages/Journal'
import Analytics from './pages/Analytics'
import More from './pages/More'
import WorkoutHome from './workout/WorkoutHome'
import WorkoutPage from './workout/WorkoutPage'
import ImportHevy from './workout/ImportHevy'
import WorkoutAnalytics from './workout/WorkoutAnalytics'
import ExerciseLibrary from './workout/ExerciseLibrary'
import RoutineEditor from './workout/RoutineEditor'
import BodyLog from './body/BodyLog'

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

  const user = session.user

  // HashRouter (#/habits) works on GitHub Pages without server rewrites.
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout user={user} />}>
          <Route index element={<Dashboard user={user} />} />
          <Route path="habits" element={<Habits user={user} />} />
          <Route path="habits/manage" element={<ManageHabits />} />
          <Route path="protein" element={<Protein />} />
          <Route path="todo" element={<Tasks />} />
          <Route path="goals" element={<Goals />} />
          <Route path="goals/:id" element={<GoalDetail />} />
          <Route path="journal" element={<Journal />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="workout" element={<WorkoutHome />} />
          <Route path="workout/import" element={<ImportHevy />} />
          <Route path="workout/progress" element={<WorkoutAnalytics />} />
          <Route path="workout/library" element={<ExerciseLibrary />} />
          <Route path="workout/routine/:id" element={<RoutineEditor />} />
          <Route path="body" element={<BodyLog />} />
          <Route path="workout/:id" element={<WorkoutPage />} />
          <Route path="more" element={<More user={user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
