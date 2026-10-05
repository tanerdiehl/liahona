import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { track } from '../lib/saveStatus'
import { formatLong } from '../lib/dates'
import { repeatWorkout, saveWorkoutAsRoutine } from './routines'
import {
  convertWeight,
  epley,
  formatDuration,
  formatVolume,
  loadSettings,
  roundWeight,
  SET_TYPES,
  setVolume,
  workoutSeconds,
} from './lib'

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export default function WorkoutSummary({ workout, justFinished, onEdit }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [settings, { data: wes, error: e1 }, { data: sets, error: e2 }] = await Promise.all([
          loadSettings(),
          supabase.from('workout_exercises').select('*, exercises(*)').eq('workout_id', workout.id).order('position'),
          supabase
            .from('workout_sets')
            .select('*')
            .eq('workout_id', workout.id)
            .eq('completed', true)
            .order('set_order'),
        ])
        if (e1 || e2) throw e1 || e2
        const unit = settings.weight_unit
        const exIds = [...new Set(wes.map((w) => w.exercise_id))]
        // Everything logged for these exercises before this workout, for PRs.
        const prior = exIds.length
          ? await fetchAll(() =>
              supabase
                .from('workout_sets')
                .select('exercise_id,weight,weight_unit,reps,completed_at')
                .in('exercise_id', exIds)
                .eq('completed', true)
                .lt('completed_at', workout.started_at)
                .order('id'),
            )
          : []
        setData({ unit, wes, sets, prs: findPRs(wes, sets, prior, unit) })
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [workout.id, workout.started_at])

  useEffect(() => {
    if (justFinished) sessionStorage.removeItem('liahona.justFinished')
  }, [justFinished])

  const [busy, setBusy] = useState('')

  async function repeat() {
    setBusy('repeat')
    try {
      const res = await repeatWorkout(workout)
      if (res.existing && !window.confirm('You already have a workout in progress. Go to it?')) return
      navigate(`/workout/${res.id}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  async function saveRoutine() {
    setBusy('routine')
    try {
      navigate(`/workout/routine/${await saveWorkoutAsRoutine(workout)}`)
    } catch (e) {
      setError(e.message)
      setBusy('')
    }
  }

  async function remove() {
    if (!window.confirm('Delete this workout and all its sets permanently?')) return
    const { error } = await track(supabase.from('workouts').delete().eq('id', workout.id))
    if (error) return setError(error.message)
    navigate('/workout')
  }

  if (!data) return <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>

  const { unit, wes, sets, prs } = data
  const volume = sets.reduce((sum, s) => {
    const we = wes.find((w) => w.id === s.workout_exercise_id)
    return sum + setVolume(s, we?.exercises?.exercise_type, unit)
  }, 0)

  return (
    <section className="narrow workout-summary">
      <div className="page-head">
        <Link to="/workout" className="btn ghost small">
          ‹ Workouts
        </Link>
        <button className="btn ghost small" onClick={onEdit}>
          Edit
        </button>
      </div>

      {justFinished && <p className="finish-banner">Workout saved. Nice work.</p>}

      <h1>{workout.name || 'Workout'}</h1>
      <p className="muted">
        {formatLong(workout.workout_date)} · {timeFmt.format(new Date(workout.started_at))}–
        {timeFmt.format(new Date(workout.ended_at))}
      </p>

      <div className="card stat-card">
        <div className="stat-row">
          <div className="stat">
            <span className="stat-value">{formatDuration(workoutSeconds(workout))}</span>
            <span className="stat-label">Duration</span>
          </div>
          <div className="stat">
            <span className="stat-value">{sets.length}</span>
            <span className="stat-label">Sets</span>
          </div>
          <div className="stat">
            <span className="stat-value">{volume > 0 ? formatVolume(volume, unit) : '—'}</span>
            <span className="stat-label">Volume</span>
          </div>
          <div className="stat">
            <span className="stat-value">{prs.length}</span>
            <span className="stat-label">New PRs</span>
          </div>
        </div>
      </div>

      <div className="summary-actions">
        <button className="btn primary" onClick={repeat} disabled={!!busy}>
          {busy === 'repeat' ? 'Starting…' : '↻ Repeat workout'}
        </button>
        <button className="btn ghost" onClick={saveRoutine} disabled={!!busy}>
          {busy === 'routine' ? 'Saving…' : 'Save as routine'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {prs.length > 0 && (
        <div className="card pr-card">
          <h2>🏆 Personal records</h2>
          <ul>
            {prs.map((p, i) => (
              <li key={i}>
                <strong>{p.exercise}</strong> — {p.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {workout.notes && <p className="summary-notes">{workout.notes}</p>}

      {wes.map((we) => {
        const mine = sets.filter((s) => s.workout_exercise_id === we.id)
        if (!mine.length) return null
        let n = 0
        return (
          <article key={we.id} className="card summary-ex">
            <h3>{we.exercises?.name}</h3>
            {we.notes && <p className="muted small">{we.notes}</p>}
            <ol className="summary-sets">
              {mine.map((s) => (
                <li key={s.id}>
                  <span className={`set-num t-${s.set_type}`}>{SET_TYPES[s.set_type].short ?? ++n}</span>
                  <span>{describeSet(s, we.exercises?.exercise_type)}</span>
                </li>
              ))}
            </ol>
          </article>
        )
      })}

      <button className="link-btn discard" onClick={remove}>
        Delete workout
      </button>
    </section>
  )
}

function describeSet(s, type) {
  const w = s.weight != null ? `${Number(s.weight)} ${s.weight_unit}` : ''
  switch (type) {
    case 'weight_reps':
      return `${w} × ${s.reps}`
    case 'weighted_bodyweight':
      return `+${w} × ${s.reps}`
    case 'assisted_bodyweight':
      return `−${w} × ${s.reps}`
    case 'bodyweight_reps':
      return `${s.reps} reps`
    case 'duration':
      return formatDuration(s.duration_seconds)
    case 'distance_duration':
      return `${s.distance ?? '—'} ${s.distance_unit} in ${formatDuration(s.duration_seconds)}`
    default:
      return ''
  }
}

// Compares this workout's best sets against everything logged before it.
// First-ever sessions of an exercise don't count as PRs.
function findPRs(wes, sets, prior, unit) {
  const out = []
  const fmt = (v) => `${roundWeight(v)} ${unit}`
  for (const we of wes) {
    const type = we.exercises?.exercise_type
    const name = we.exercises?.name
    const mine = sets.filter((s) => s.workout_exercise_id === we.id)
    const before = prior.filter((s) => s.exercise_id === we.exercise_id)
    if (!mine.length || !before.length) continue

    if (type === 'weight_reps' || type === 'weighted_bodyweight') {
      const w = (s) => convertWeight(Number(s.weight ?? 0), s.weight_unit, unit)
      const best = (list, f) => Math.max(0, ...list.map(f))
      const checks = [
        ['Heaviest weight', (s) => w(s), fmt],
        ['Best est. 1RM', (s) => epley(w(s), s.reps ?? 0), fmt],
        ['Best set volume', (s) => w(s) * (s.reps ?? 0), (v) => `${Math.round(v)} ${unit}`],
      ]
      for (const [label, f, show] of checks) {
        const now = best(mine, f)
        if (now > best(before, f) + 1e-9) out.push({ exercise: name, label: `${label}: ${show(now)}` })
      }
    } else if (type === 'bodyweight_reps') {
      const now = Math.max(0, ...mine.map((s) => s.reps ?? 0))
      if (now > Math.max(0, ...before.map((s) => s.reps ?? 0))) out.push({ exercise: name, label: `Most reps: ${now}` })
    }
  }
  return out
}
