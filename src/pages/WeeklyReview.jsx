import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAll, fetchHabits } from '../lib/habits'
import { track } from '../lib/saveStatus'
import { addDays, dateRange, formatShort, startOfWeek, todayISO } from '../lib/dates'
import { getSettings } from '../lib/settings'
import { useTasks } from '../lib/useTasks'
import TaskList from '../components/TaskList'
import { buildModel, prEvents } from '../workout/stats'
import { convertWeight, formatDuration, roundWeight } from '../workout/lib'
import { PROTEIN_MIN } from './Protein'

const round1 = (v) => Math.round(v * 10) / 10

// /review — how last week went, and plan the next one.
export default function WeeklyReview() {
  const today = todayISO()
  const thisWeek = startOfWeek(today)
  const [from, setFrom] = useState(addDays(thisWeek, -7))
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const to = addDays(from, 6)
  const isLastWeek = from === addDays(thisWeek, -7)

  useEffect(() => {
    setData(null)
    load(from, addDays(from, 6))
      .then(setData)
      .catch((e) => setError(e.message))
  }, [from])

  return (
    <section className="narrow review">
      <div className="page-head">
        <h1>Weekly review</h1>
      </div>
      <div className="range-nav">
        <button className="btn ghost small" onClick={() => setFrom(addDays(from, -7))} aria-label="Previous week">
          ‹
        </button>
        <span>
          {formatShort(from)} – {formatShort(to)}
          {from === thisWeek && <span className="muted small"> (so far)</span>}
        </span>
        <button
          className="btn ghost small"
          onClick={() => setFrom(addDays(from, 7))}
          disabled={from >= thisWeek}
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {!data ? <p className="muted">Loading…</p> : <Summary data={data} />}

      {(isLastWeek || from === thisWeek) && <PlanAhead thisWeek={thisWeek} today={today} />}
    </section>
  )
}

async function load(from, to) {
  const today = todayISO()
  const [settings, habits, logs, workouts, sets, exercises, protein, body, tasks, journal] = await Promise.all([
    getSettings(),
    fetchHabits(),
    fetchAll(() => supabase.from('habit_logs').select('habit_id,date,status').gte('date', from).lte('date', to).order('date')),
    fetchAll(() => supabase.from('workouts').select('id,workout_date,name,started_at,ended_at').order('id')),
    fetchAll(() =>
      supabase
        .from('workout_sets')
        .select('id,workout_id,exercise_id,weight,weight_unit,reps,duration_seconds,set_type,completed')
        .eq('completed', true)
        .order('id'),
    ),
    fetchAll(() => supabase.from('exercises').select('*').order('id')),
    fetchAll(() => supabase.from('protein_entries').select('date,grams').gte('date', from).lte('date', to).order('id')),
    fetchAll(() => supabase.from('body_logs').select('*').not('bodyweight', 'is', null).lte('log_date', to).order('log_date')),
    fetchAll(() =>
      supabase
        .from('tasks')
        .select('title,completed_at')
        .gte('completed_at', `${from}T00:00:00`)
        .lte('completed_at', `${addDays(to, 1)}T06:00:00`)
        .order('completed_at'),
    ),
    fetchAll(() => supabase.from('journal_entries').select('entry_date').gte('entry_date', from).lte('entry_date', to).order('id')),
  ])
  const unit = settings.weight_unit
  const start = settings.tracking_start ?? ''

  // Habits: share of days done (daily) or done/not (weekly).
  const days = dateRange(from, to).filter((d) => d <= today && d >= start)
  const habitRows = habits
    .filter((h) => !h.archived)
    .map((h) => {
      const mine = logs.filter((l) => l.habit_id === h.id && l.status === 'done')
      if (h.frequency === 'weekly') return { h, weekly: true, done: mine.some((l) => l.date === from) }
      return { h, done: mine.filter((l) => days.includes(l.date)).length, total: days.length }
    })

  // Training, including PRs set this week (compared with all earlier history).
  const { sessions } = buildModel({ workouts, sets, exercises, unit })
  const week = sessions.filter((s) => s.date >= from && s.date <= to)
  const prs = prEvents(sessions).filter((e) => e.date >= from && e.date <= to)

  // Protein per logged day.
  const perDay = {}
  for (const p of protein) perDay[p.date] = (perDay[p.date] ?? 0) + Number(p.grams)
  const proteinDays = Object.values(perDay)

  // Bodyweight: last entry before/at the week start vs last entry in the week.
  const w = body.map((b) => ({ date: b.log_date, v: convertWeight(Number(b.bodyweight), b.weight_unit, unit) }))
  const startW = [...w].reverse().find((x) => x.date < from) ?? w.find((x) => x.date >= from)
  const endW = [...w].reverse().find((x) => x.date <= to && x.date >= from)

  return {
    unit,
    habitRows,
    workouts: week,
    sets: week.reduce((n, s) => n + s.workingSets, 0),
    volume: week.reduce((n, s) => n + s.volume, 0),
    seconds: week.reduce((n, s) => n + s.seconds, 0),
    prs,
    proteinAvg: proteinDays.length ? proteinDays.reduce((a, b) => a + b, 0) / proteinDays.length : null,
    proteinHit: proteinDays.filter((g) => g >= PROTEIN_MIN).length,
    proteinLogged: proteinDays.length,
    weight: endW ? { end: endW.v, change: startW && startW !== endW ? endW.v - startW.v : null } : null,
    tasksDone: tasks,
    journalCount: journal.length,
  }
}

function Summary({ data }) {
  const { unit } = data
  return (
    <>
      <article className="card review-card">
        <h2 className="wa-title">Habits</h2>
        <ul className="review-habits">
          {data.habitRows.map(({ h, weekly, done, total }) => (
            <li key={h.id}>
              <span className="dot" style={{ background: h.color }} />
              <span className="grow">{h.name}</span>
              {weekly ? (
                <span className={done ? 'review-yes' : 'muted'}>{done ? '✓ Done' : 'Not done'}</span>
              ) : (
                <>
                  <span className="muscle-bar review-bar">
                    <span style={{ width: `${total ? (done / total) * 100 : 0}%`, background: h.color }} />
                  </span>
                  <span className="review-count">
                    {done}/{total}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </article>

      <article className="card review-card">
        <h2 className="wa-title">Training</h2>
        <div className="stat-row">
          <Stat value={data.workouts.length} label="Workouts" />
          <Stat value={data.sets} label="Working sets" />
          <Stat value={data.volume ? `${Math.round(data.volume).toLocaleString()} ${unit}` : '—'} label="Volume" />
          <Stat value={data.seconds ? formatDuration(data.seconds) : '—'} label="Time training" />
        </div>
        {data.workouts.length > 0 && (
          <ul className="session-list">
            {data.workouts.map((s) => (
              <li key={s.id}>
                <Link to={`/workout/${s.id}`}>
                  <span className="muted small">{formatShort(s.date)}</span>
                  <span className="grow">{s.name || 'Workout'}</span>
                  <span className="muted small">{s.workingSets} sets</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {data.prs.length > 0 && (
          <div className="review-prs">
            <strong>🏆 {data.prs.length} new PR{data.prs.length === 1 ? '' : 's'}</strong>
            <ul>
              {data.prs.slice(0, 8).map((e, i) => (
                <li key={i}>
                  {e.ex.name} — {e.kind}:{' '}
                  {e.kind === 'Most reps' ? `${e.value} reps` : `${roundWeight(e.value)} ${unit}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <article className="card review-card">
        <h2 className="wa-title">Nutrition &amp; body</h2>
        <div className="stat-row">
          <Stat value={data.proteinAvg == null ? '—' : `${Math.round(data.proteinAvg)} g`} label="Avg protein / logged day" />
          <Stat value={`${data.proteinHit}/${data.proteinLogged}`} label={`Days ≥ ${PROTEIN_MIN} g`} />
          <Stat value={data.weight ? `${round1(data.weight.end)} ${unit}` : '—'} label="Bodyweight" />
          {data.weight?.change != null && (
            <Stat
              value={`${data.weight.change > 0 ? '+' : ''}${round1(data.weight.change)} ${unit}`}
              label="Change this week"
            />
          )}
        </div>
      </article>

      <article className="card review-card">
        <h2 className="wa-title">Done</h2>
        <p>
          <strong>{data.tasksDone.length}</strong> task{data.tasksDone.length === 1 ? '' : 's'} completed ·{' '}
          <strong>{data.journalCount}</strong> journal entr{data.journalCount === 1 ? 'y' : 'ies'}
        </p>
        {data.tasksDone.length > 0 && (
          <ul className="review-tasks">
            {data.tasksDone
              .filter((t) => t.title)
              .slice(0, 10)
              .map((t, i) => (
                <li key={i}>✓ {t.title}</li>
              ))}
          </ul>
        )}
      </article>
    </>
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

// Plan the current week: weekly habits, "This week" list, and a reflection.
function PlanAhead({ thisWeek, today }) {
  const api = useTasks('week')
  const [weekly, setWeekly] = useState([])
  const [reflection, setReflection] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const habits = (await fetchHabits()).filter((h) => !h.archived && h.frequency === 'weekly')
      if (!habits.length) return
      const { data } = await supabase
        .from('habit_logs')
        .select('habit_id,status')
        .eq('date', thisWeek)
        .in(
          'habit_id',
          habits.map((h) => h.id),
        )
      setWeekly(habits.map((h) => ({ h, done: data?.some((l) => l.habit_id === h.id && l.status === 'done') })))
    })().catch(() => {})
  }, [thisWeek])

  async function markDone(h) {
    setWeekly((prev) => prev.map((x) => (x.h.id === h.id ? { ...x, done: true } : x)))
    const { error } = await track(
      supabase.from('habit_logs').upsert({ habit_id: h.id, date: thisWeek, status: 'done', updated_at: new Date().toISOString() }),
    )
    if (error) setError(error.message)
  }

  async function saveReflection() {
    if (!reflection.trim()) return
    const { error } = await track(
      supabase.from('journal_entries').insert({
        entry_date: today,
        body: `Weekly review — week of ${formatShort(addDays(thisWeek, -7))}\n\n${reflection.trim()}`,
      }),
    )
    if (error) return setError(error.message)
    setReflection('')
    setSaved(true)
  }

  return (
    <>
      <h2 className="section-title">Plan the week of {formatShort(thisWeek)}</h2>
      {error && <p className="error">{error}</p>}
      {weekly.map(({ h, done }) => (
        <div key={h.id} className="card review-weekly">
          <span className="dot" style={{ background: h.color }} />
          <span className="grow">{h.name}</span>
          {done ? (
            <span className="review-yes">✓ Done this week</span>
          ) : (
            <button className="btn primary small" onClick={() => markDone(h)}>
              Mark done
            </button>
          )}
        </div>
      ))}
      <div className="card keep review-list">
        <p className="muted small">This week’s list</p>
        <TaskList api={api} />
      </div>
      <div className="card review-reflect">
        <label>
          Reflection
          <textarea
            rows={4}
            placeholder="What went well? What will you do differently this week?"
            value={reflection}
            onChange={(e) => {
              setReflection(e.target.value)
              setSaved(false)
            }}
          />
        </label>
        <div className="form-actions">
          {saved && <span className="muted small grow">Saved to your journal ✓</span>}
          <button className="btn primary" onClick={saveReflection} disabled={!reflection.trim()}>
            Save to journal
          </button>
        </div>
      </div>
    </>
  )
}
