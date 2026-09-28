import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchActiveWorkout, formatDuration, workoutSeconds } from './lib'
import { useNow } from './useNow'

// Shown on every page while a workout is open, so it's one tap to get back.
export default function ActiveWorkoutBar() {
  const { pathname } = useLocation()
  const [active, setActive] = useState(null)
  const now = useNow(1000)

  useEffect(() => {
    fetchActiveWorkout()
      .then(setActive)
      .catch(() => setActive(null))
  }, [pathname])

  if (!active || pathname === `/workout/${active.id}`) return null
  return (
    <Link to={`/workout/${active.id}`} className="active-bar">
      <span className="pulse-dot" aria-hidden />
      <span className="grow">{active.name || 'Workout'} in progress</span>
      <span className="timer">{formatDuration(workoutSeconds(active, now))}</span>
      <span aria-hidden>›</span>
    </Link>
  )
}
