import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { formatLong, formatShort, todayISO } from '../lib/dates'
import { formatDuration, loadSettings, roundWeight } from './lib'
import {
  bucketBounds,
  bucketKey,
  bucketLabel,
  bucketRange,
  buildModel,
  exerciseHistory,
  exercisesWithHistory,
  GRANULARITIES,
  muscleBreakdown,
  prEvents,
  timeline,
} from './stats'
import { BarChart, LineChart, TrainingCalendar } from './WorkoutCharts'
import { bucketed, fetchBodyLogs, round1, series } from '../body/body'

const COLOR = '#1D9E75' // physical-strength teal
const LINE = '#7F77DD'
const G_KEY = 'liahona.wa.granularity'
const EX_KEY = 'liahona.wa.exercise'

const store = {
  get: (k, fallback) => {
    try {
      return localStorage.getItem(k) ?? fallback
    } catch {
      return fallback
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* per-device preference only */
    }
  },
}

const compact = (v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`)
const hoursMin = (sec) => {
  const m = Math.round(sec / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

export default function WorkoutAnalytics() {
  const [raw, setRaw] = useState(null)
  const [error, setError] = useState('')
  // Month by default; an old saved "year" choice falls back to month.
  const [g, setG] = useState(() => (store.get(G_KEY, 'month') === 'week' ? 'week' : 'month'))

  useEffect(() => {
    ;(async () => {
      try {
        const [settings, exercises, workouts, sets, body] = await Promise.all([
          loadSettings(),
          fetchAll(() => supabase.from('exercises').select('*').order('id')),
          fetchAll(() =>
            supabase.from('workouts').select('id,workout_date,name,started_at,ended_at').order('id'),
          ),
          fetchAll(() =>
            supabase
              .from('workout_sets')
              .select('id,workout_id,exercise_id,weight,weight_unit,reps,duration_seconds,distance,set_type,completed')
              .eq('completed', true)
              .order('id'),
          ),
          fetchBodyLogs().catch(() => []),
        ])
        setRaw({ unit: settings.weight_unit, exercises, workouts, sets, body })
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [])

  const model = useMemo(() => raw && buildModel(raw), [raw])
  const today = todayISO()

  if (error) return <p className="error">{error}</p>
  if (!model) return <p className="muted">Loading…</p>

  const { sessions } = model
  const unit = raw.unit
  const chooseG = (v) => {
    setG(v)
    store.set(G_KEY, v)
  }

  if (!sessions.length)
    return (
      <section className="narrow">
        <BackLink />
        <h1>Progress</h1>
        <p className="empty-quip">Finish a workout and your progress will start showing up here.</p>
      </section>
    )

  const totalSets = sessions.reduce((n, s) => n + s.workingSets, 0)
  const totalVolume = sessions.reduce((n, s) => n + s.volume, 0)
  const avgSeconds = sessions.reduce((n, s) => n + s.seconds, 0) / sessions.length
  const tl = timeline(sessions, g, today)
  const gLabel = GRANULARITIES.find(([k]) => k === g)[1].toLowerCase()

  return (
    <section className="wa">
      <BackLink />
      <div className="page-head">
        <h1>Progress</h1>
        <div className="segmented">
          {GRANULARITIES.map(([k, l]) => (
            <button key={k} className={g === k ? 'on' : ''} onClick={() => chooseG(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small wa-since">
        Since {formatLong(sessions[0].date)} · warm-up sets aren't counted in volume or PRs
      </p>

      <div className="card stat-card">
        <div className="stat-row">
          <Stat value={sessions.length} label="Workouts" />
          <Stat value={totalSets.toLocaleString()} label="Working sets" />
          <Stat value={`${compact(totalVolume)} ${unit}`} label="Total volume" />
          <Stat value={hoursMin(avgSeconds)} label="Avg workout" />
        </div>
      </div>

      <div className="wa-grid">
        <article className="card">
          <h2 className="wa-title">Workouts per {gLabel}</h2>
          <BarChart
            color={COLOR}
            data={tl.map((b) => ({
              key: b.key,
              label: bucketLabel(b.key, g),
              value: b.sessions,
              tip: `${bucketLabel(b.key, g)}: ${b.sessions} workout${b.sessions === 1 ? '' : 's'}${b.seconds ? ` · ${hoursMin(b.seconds)}` : ''}`,
            }))}
          />
        </article>

        <article className="card">
          <h2 className="wa-title">Volume per {gLabel}</h2>
          <BarChart
            color={COLOR}
            format={compact}
            data={tl.map((b) => ({
              key: b.key,
              label: bucketLabel(b.key, g),
              value: b.volume,
              tip: `${bucketLabel(b.key, g)}: ${Math.round(b.volume).toLocaleString()} ${unit} · ${b.sets} sets`,
            }))}
          />
        </article>

        <MuscleCard sessions={sessions} g={g} today={today} unit={unit} />

        <article className="card">
          <h2 className="wa-title">Calendar</h2>
          <TrainingCalendar sessions={sessions} color={COLOR} />
        </article>
      </div>

      <ExerciseSection
        sessions={sessions}
        g={g}
        today={today}
        unit={unit}
        weights={series(raw.body, 'bodyweight', unit)}
      />

      <RecentPRs sessions={sessions} unit={unit} />
    </section>
  )
}

function BackLink() {
  return (
    <div className="page-head wa-back">
      <Link to="/workout" className="btn ghost small">
        ‹ Workouts
      </Link>
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

// Working sets per muscle group for one week/month/year, with ‹ › to step back.
function MuscleCard({ sessions, g, today, unit }) {
  const keys = bucketRange(sessions[0].date, today, g)
  const [offset, setOffset] = useState(0)
  useEffect(() => setOffset(0), [g])
  const key = keys[Math.max(0, keys.length - 1 - offset)]
  const [from, to] = bucketBounds(key, g)
  const rows = muscleBreakdown(sessions, from, to)
  const max = Math.max(1, ...rows.map((r) => r.sets))
  const current = key === bucketKey(today, g)

  return (
    <article className="card">
      <div className="wa-title-row">
        <h2 className="wa-title">Muscle groups</h2>
        <div className="mini-nav">
          <button
            className="btn ghost small"
            onClick={() => setOffset(offset + 1)}
            disabled={offset >= keys.length - 1}
            aria-label="Earlier"
          >
            ‹
          </button>
          <span className="muted small">
            {current ? `This ${g}` : g === 'week' ? `Week of ${formatShort(key)}` : bucketLabel(key, g)}
          </span>
          <button className="btn ghost small" onClick={() => setOffset(offset - 1)} disabled={offset === 0} aria-label="Later">
            ›
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="muted small">No training logged in this {g}.</p>
      ) : (
        <ul className="muscle-list">
          {rows.map((r) => (
            <li key={r.muscle}>
              <span className="muscle-name">{r.muscle}</span>
              <span className="muscle-bar">
                <span style={{ width: `${(r.sets / max) * 100}%`, background: COLOR }} />
              </span>
              <span className="muscle-val">
                {r.sets} sets
                {r.volume > 0 && <span className="muted"> · {compact(r.volume)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Working sets per muscle (volume in {unit}). Uneven bars point to imbalances.</p>
    </article>
  )
}

function ExerciseSection({ sessions, g, today, unit, weights }) {
  const location = useLocation()
  const options = useMemo(() => exercisesWithHistory(sessions), [sessions])
  const fallback = options.find((e) => e.exercise_type === 'weight_reps')?.id ?? options[0]?.id
  const [exId, setExId] = useState(() => {
    const requested = location.state?.exerciseId
    if (options.some((o) => o.id === requested)) return requested
    const saved = store.get(EX_KEY, null)
    return options.some((o) => o.id === saved) ? saved : fallback
  })
  const ex = options.find((o) => o.id === exId)
  const history = useMemo(() => exerciseHistory(sessions, exId), [sessions, exId])
  useEffect(() => {
    if (location.state?.exerciseId) document.getElementById('exercise')?.scrollIntoView()
  }, [location.state])
  if (!ex) return null

  const type = ex.exercise_type
  const loaded = type === 'weight_reps' || type === 'weighted_bodyweight'
  const keys = history.length ? bucketRange(history[0].date, today, g) : []
  const bucket = (pick) =>
    keys.map((k) => {
      const inB = history.filter((h) => bucketKey(h.date, g) === k)
      return { key: k, label: bucketLabel(k, g), items: inB, value: inB.length ? pick(inB) : 0 }
    })

  const best = (f) => Math.max(0, ...history.map(f))
  const whenBest = (f) => {
    const v = best(f)
    return history.find((h) => f(h) === v)
  }
  const prs = loaded
    ? [
        ['Heaviest weight', (h) => h.maxWeight, (v) => `${roundWeight(v)} ${unit}`],
        ...(type === 'weight_reps' ? [['Best est. 1RM', (h) => h.bestE1rm, (v) => `${roundWeight(v)} ${unit}`]] : []),
        ['Best set volume', (h) => h.bestSetVolume, (v) => `${Math.round(v).toLocaleString()} ${unit}`],
        ['Most reps', (h) => h.maxReps, (v) => `${v}`],
      ]
    : type === 'duration' || type === 'distance_duration'
      ? [['Longest', (h) => h.maxSeconds, formatDuration]]
      : [['Most reps', (h) => h.maxReps, (v) => `${v}`]]

  const mainSeries =
    type === 'weight_reps'
      ? { title: 'Estimated 1RM', pick: (b) => Math.max(...b.map((h) => h.bestE1rm)), fmt: (v) => `${roundWeight(v)}` }
      : loaded
        ? { title: 'Heaviest weight', pick: (b) => Math.max(...b.map((h) => h.maxWeight)), fmt: (v) => `${roundWeight(v)}` }
        : type === 'duration' || type === 'distance_duration'
          ? { title: 'Longest set', pick: (b) => Math.max(...b.map((h) => h.maxSeconds)), fmt: formatDuration }
          : { title: 'Most reps in a set', pick: (b) => Math.max(...b.map((h) => h.maxReps)), fmt: (v) => `${v}` }

  return (
    <section className="wa-exercise" id="exercise">
      <div className="wa-title-row">
        <h2 className="section-title">Exercise</h2>
      </div>
      <select
        className="ex-select"
        value={exId}
        onChange={(e) => {
          setExId(e.target.value)
          store.set(EX_KEY, e.target.value)
        }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.setCount} sets)
          </option>
        ))}
      </select>

      <div className="card stat-card">
        <div className="stat-row">
          {prs.map(([label, f, fmt]) => {
            const h = whenBest(f)
            return (
              <div key={label} className="stat">
                <span className="stat-value">{fmt(best(f))}</span>
                <span className="stat-label">
                  {label}
                  {h && ` · ${formatShort(h.date)}`}
                </span>
              </div>
            )
          })}
          {type === 'weight_reps' && weights.length > 0 && best((h) => h.bestE1rm) > 0 && (
            <Stat
              value={`${(best((h) => h.bestE1rm) / weights.at(-1).value).toFixed(2)}×`}
              label="Best 1RM ÷ bodyweight"
            />
          )}
          <Stat value={history.length} label="Sessions" />
        </div>
      </div>

      <div className="wa-grid">
        <article className="card">
          <h3 className="wa-title">
            {mainSeries.title} {loaded && <span className="muted small">({unit})</span>}
          </h3>
          <LineChart
            color={LINE}
            format={mainSeries.fmt}
            data={bucket(mainSeries.pick).map((b) => ({
              key: b.key,
              label: b.label,
              value: b.value,
              tip: `${b.label}: ${mainSeries.fmt(b.value)}${loaded ? ` ${unit}` : ''}`,
            }))}
          />
          {type === 'weight_reps' && (
            <p className="muted small">Estimated 1RM = weight × (1 + reps ÷ 30), best set of each {g}.</p>
          )}
          {history.length > 0 && weights.some((w) => w.date >= history[0].date) && (
            <>
              <h3 className="wa-title">
                Bodyweight <span className="muted small">({unit}, same timeline)</span>
              </h3>
              <LineChart
                color="#3B4A6B"
                format={(v) => `${Math.round(v)}`}
                data={bucketed(weights, g, history[0].date, today).map((b) => ({
                  ...b,
                  tip: `${b.label}: ${round1(b.value)} ${unit}`,
                }))}
              />
            </>
          )}
        </article>

        {loaded && (
          <article className="card">
            <h3 className="wa-title">
              Volume per {g} <span className="muted small">({unit})</span>
            </h3>
            <BarChart
              color={COLOR}
              format={compact}
              data={bucket((b) => b.reduce((n, h) => n + h.volume, 0)).map((b) => ({
                key: b.key,
                label: b.label,
                value: b.value,
                tip: `${b.label}: ${Math.round(b.value).toLocaleString()} ${unit} · ${b.items.reduce((n, h) => n + h.sets, 0)} sets`,
              }))}
            />
          </article>
        )}
      </div>

      <article className="card">
        <h3 className="wa-title">Sessions</h3>
        <ul className="session-list">
          {history
            .slice()
            .reverse()
            .slice(0, 12)
            .map((h) => (
              <li key={h.workoutId}>
                <Link to={`/workout/${h.workoutId}`}>
                  <span className="muted small">{formatShort(h.date)}</span>
                  <span className="grow">{describeTop(h, type, unit)}</span>
                  <span className="muted small">{h.sets} sets</span>
                </Link>
              </li>
            ))}
        </ul>
      </article>
    </section>
  )
}

function describeTop(h, type, unit) {
  const t = h.topSet
  if (type === 'weight_reps')
    return `${roundWeight(t.w)} ${unit} × ${t.reps}${t.e1rm ? ` · 1RM ≈ ${roundWeight(t.e1rm)}` : ''}`
  if (type === 'weighted_bodyweight') return `+${roundWeight(h.maxWeight)} ${unit} · ${h.maxReps} reps best`
  if (type === 'assisted_bodyweight') return `${h.maxReps} reps best`
  if (type === 'duration' || type === 'distance_duration') return `${formatDuration(h.maxSeconds)} best`
  return `${h.maxReps} reps best`
}

function RecentPRs({ sessions, unit }) {
  const events = useMemo(() => prEvents(sessions).slice(0, 12), [sessions])
  if (!events.length) return null
  const fmt = (e) =>
    e.kind === 'Most reps'
      ? `${e.value} reps`
      : e.kind === 'Best set volume'
        ? `${Math.round(e.value).toLocaleString()} ${unit}`
        : `${roundWeight(e.value)} ${unit}`
  return (
    <>
      <h2 className="section-title">🏆 Recent PRs</h2>
      <article className="card">
        <ul className="session-list">
          {events.map((e, i) => (
            <li key={i}>
              <Link to={`/workout/${e.workoutId}`}>
                <span className="muted small">{formatShort(e.date)}</span>
                <span className="grow">
                  <strong>{e.ex.name}</strong> — {e.kind}
                </span>
                <span>{fmt(e)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </>
  )
}
