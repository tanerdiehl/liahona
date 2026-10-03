import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track } from '../lib/saveStatus'
import { formatLong, todayISO } from '../lib/dates'
import {
  defaultWorkoutName,
  ensureExercisesSeeded,
  fetchActiveWorkout,
  formatDuration,
  formatVolume,
  loadSettings,
  setVolume,
  uuid,
  workoutSeconds,
} from './lib'
import { useNow } from './useNow'
import { invalidateSettings } from '../lib/settings'

export default function WorkoutHome() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(null)
  const [active, setActive] = useState(undefined)
  const [recent, setRecent] = useState(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const now = useNow(1000)

  useEffect(() => {
    ;(async () => {
      try {
        const s = await loadSettings()
        setSettings(s)
        await ensureExercisesSeeded(s)
        setActive(await fetchActiveWorkout())
        setRecent(await fetchRecent(s.weight_unit))
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [])

  async function start() {
    if (active) return navigate(`/workout/${active.id}`)
    setStarting(true)
    const id = uuid()
    const { error } = await track(
      supabase.from('workouts').insert({ id, name: defaultWorkoutName(), workout_date: todayISO() }),
    )
    setStarting(false)
    if (error) return setError(`Couldn't start — ${error.message}`)
    navigate(`/workout/${id}`)
  }

  async function setUnit(weight_unit) {
    setSettings((s) => ({ ...s, weight_unit }))
    const { error } = await track(supabase.from('user_settings').update({ weight_unit }).eq('user_id', settings.user_id))
    if (error) setError(error.message)
    invalidateSettings()
    setRecent(await fetchRecent(weight_unit))
  }

  if (error && !settings)
    return (
      <section className="narrow">
        <h1>Workout</h1>
        <p className="error">{error}</p>
        <p className="muted small">If this mentions a missing table, the workout database update hasn't been run yet.</p>
      </section>
    )
  if (!settings || active === undefined) return <p className="muted">Loading…</p>

  return (
    <section className="narrow workout-home">
      <div className="page-head">
        <h1>Workout</h1>
        <div className="segmented small-seg">
          {['lbs', 'kg'].map((u) => (
            <button key={u} className={settings.weight_unit === u ? 'on' : ''} onClick={() => setUnit(u)}>
              {u}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {active ? (
        <Link to={`/workout/${active.id}`} className="card resume-card">
          <span className="pulse-dot" aria-hidden />
          <span className="grow">
            <strong>{active.name || 'Workout'} in progress</strong>
            <span className="muted small">Tap to resume</span>
          </span>
          <span className="timer">{formatDuration(workoutSeconds(active, now))}</span>
        </Link>
      ) : (
        <button className="start-btn" onClick={start} disabled={starting}>
          <span className="start-plus">+</span>
          {starting ? 'Starting…' : 'Start workout'}
        </button>
      )}

      <h2 className="section-title">Recent</h2>
      {!recent ? (
        <p className="muted">Loading…</p>
      ) : recent.length === 0 ? (
        <p className="empty-quip">Your first workout is the hardest one to log. Tap + and go.</p>
      ) : (
        <ul className="workout-list">
          {recent.map((w) => (
            <li key={w.id}>
              <Link to={`/workout/${w.id}`} className="card workout-row">
                <span className="workout-row-head">
                  <strong>{w.name || 'Workout'}</strong>
                  <span className="muted small">{formatLong(w.workout_date)}</span>
                </span>
                <span className="workout-stats">
                  <span>⏱ {formatDuration(workoutSeconds(w))}</span>
                  <span>{w.setCount} sets</span>
                  {w.volume > 0 && <span>{formatVolume(w.volume, settings.weight_unit)}</span>}
                </span>
                {w.exerciseNames.length > 0 && <span className="muted small">{w.exerciseNames.join(' · ')}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

async function fetchRecent(unit) {
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('*')
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(20)
  if (error) throw error
  if (!workouts.length) return []
  const { data: sets, error: e2 } = await supabase
    .from('workout_sets')
    .select('workout_id,weight,weight_unit,reps,completed,exercise_id,exercises(name,exercise_type)')
    .in(
      'workout_id',
      workouts.map((w) => w.id),
    )
    .eq('completed', true)
  if (e2) throw e2
  return workouts.map((w) => {
    const mine = sets.filter((s) => s.workout_id === w.id)
    const names = [...new Set(mine.map((s) => s.exercises?.name).filter(Boolean))]
    return {
      ...w,
      setCount: mine.length,
      volume: mine.reduce((sum, s) => sum + setVolume(s, s.exercises?.exercise_type, unit), 0),
      exerciseNames: names.slice(0, 4).concat(names.length > 4 ? [`+${names.length - 4}`] : []),
    }
  })
}
