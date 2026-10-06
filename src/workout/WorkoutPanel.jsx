import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track } from '../lib/saveStatus'
import { formatShort, startOfWeek, todayISO } from '../lib/dates'
import { convertWeight, fetchActiveWorkout, formatDuration, loadSettings, workoutSeconds } from './lib'
import { fetchRoutineData, startFromRoutine } from './routines'
import { useNow } from './useNow'

const round1 = (v) => Math.round(v * 10) / 10

// Dashboard card: resume or start a workout, this week's count, and a
// quick bodyweight entry.
export default function WorkoutPanel() {
  const navigate = useNavigate()
  const now = useNow(1000)
  const [data, setData] = useState(null)
  const [weight, setWeight] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const today = todayISO()
      const [settings, active, routines, week, last, body] = await Promise.all([
        loadSettings(),
        fetchActiveWorkout(),
        fetchRoutineData().then((d) => d.routines.filter((r) => r.routine_exercises.length)),
        supabase
          .from('workouts')
          .select('id', { count: 'exact', head: true })
          .not('ended_at', 'is', null)
          .gte('workout_date', startOfWeek(today)),
        supabase
          .from('workouts')
          .select('id,name,workout_date')
          .not('ended_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(1),
        supabase
          .from('body_logs')
          .select('bodyweight,weight_unit,log_date')
          .not('bodyweight', 'is', null)
          .order('log_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1),
      ])
      setData({
        unit: settings.weight_unit,
        active,
        routines,
        weekCount: week.count ?? 0,
        last: last.data?.[0],
        body: body.data?.[0],
      })
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function start(routine) {
    setBusy(routine.id)
    try {
      const res = await startFromRoutine(routine)
      navigate(`/workout/${res.id}`)
    } catch (e) {
      setError(e.message)
      setBusy('')
    }
  }

  async function logWeight(e) {
    e.preventDefault()
    const n = Number(weight.replace(',', '.'))
    if (!(n > 0)) return
    setBusy('weight')
    const { error } = await track(
      supabase.from('body_logs').insert({ log_date: todayISO(), bodyweight: n, weight_unit: data.unit }),
    )
    setBusy('')
    if (error) return setError(`Not saved — ${error.message}`)
    setWeight('')
    load()
  }

  return (
    <article className="card dash-card dash-workout">
      <header className="dash-card-head">
        <h2>Workout</h2>
        <Link to="/workout" className="dash-link">
          Open ›
        </Link>
      </header>
      {error && <p className="error">{error}</p>}
      {!data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {data.active ? (
            <Link to={`/workout/${data.active.id}`} className="resume-card dash-resume">
              <span className="pulse-dot" aria-hidden />
              <span className="grow">{data.active.name || 'Workout'} in progress</span>
              <span className="timer">{formatDuration(workoutSeconds(data.active, now))}</span>
            </Link>
          ) : (
            <div className="dash-routines">
              {data.routines.slice(0, 4).map((r) => (
                <button key={r.id} className="btn primary small" onClick={() => start(r)} disabled={!!busy}>
                  {busy === r.id ? 'Starting…' : `▶ ${r.name}`}
                </button>
              ))}
              <Link to="/workout" className="btn ghost small">
                + Empty
              </Link>
            </div>
          )}
          <p className="muted small">
            {data.weekCount} workout{data.weekCount === 1 ? '' : 's'} this week
            {data.last && ` · last: ${data.last.name || 'Workout'}, ${formatShort(data.last.workout_date)}`}
          </p>
          <form className="quick-add dash-weight" onSubmit={logWeight}>
            <input
              inputMode="decimal"
              placeholder={
                data.body
                  ? `Weight (last ${round1(convertWeight(Number(data.body.bodyweight), data.body.weight_unit, data.unit))} ${data.unit})`
                  : `Today's weight (${data.unit})`
              }
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              aria-label="Today's bodyweight"
            />
            <button className="btn ghost" disabled={busy === 'weight'}>
              Log
            </button>
          </form>
        </>
      )}
    </article>
  )
}
