import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll, fetchHabits } from '../lib/habits'
import { habitStats, pctLabel } from '../lib/stats'
import { addDays, todayISO } from '../lib/dates'
import { Heatmap, ProteinChart, TrendBars } from '../components/Charts'
import { PROTEIN_MAX, PROTEIN_MIN } from './Protein'
import { Link } from 'react-router-dom'
import { fetchGoals, TIERS } from '../lib/goals'
import GoalProgress from '../components/GoalProgress'
import { getSettings } from '../lib/settings'

export default function Analytics() {
  const [habits, setHabits] = useState(null)
  const [logs, setLogs] = useState(null) // Map habitId -> Map(date -> status)
  const [protein, setProtein] = useState(null) // Map date -> total grams
  const [goals, setGoals] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState('')
  const [trackingStart, setTrackingStart] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [h, logRows, proteinRows, settings] = await Promise.all([
          fetchHabits(),
          fetchAll(() => supabase.from('habit_logs').select('habit_id,date,status').order('date')),
          fetchAll(() => supabase.from('protein_entries').select('date,grams').order('date')),
          getSettings().catch(() => ({})),
        ])
        // Ignore anything from before you started tracking (hidden, not deleted).
        const ts = settings.tracking_start ?? ''
        const byHabit = new Map()
        for (const r of logRows) {
          if (r.date < ts) continue
          if (!byHabit.has(r.habit_id)) byHabit.set(r.habit_id, new Map())
          byHabit.get(r.habit_id).set(r.date, r.status)
        }
        const totals = new Map()
        for (const r of proteinRows) if (r.date >= ts) totals.set(r.date, (totals.get(r.date) ?? 0) + Number(r.grams))
        setTrackingStart(ts || null)
        setHabits(h)
        setLogs(byHabit)
        setProtein(totals)
      } catch (e) {
        setError(e.message)
      }
      fetchGoals()
        .then(setGoals)
        .catch(() => setGoals([]))
    })()
  }, [])

  const statsById = useMemo(() => {
    const m = new Map()
    if (habits) for (const h of habits) m.set(h.id, habitStats(h, logs.get(h.id) ?? new Map(), todayISO(), trackingStart))
    return m
  }, [habits, logs, trackingStart])

  if (error) return <p className="error">{error}</p>
  if (!habits) return <p className="muted">Loading…</p>

  const archivedCount = habits.filter((h) => h.archived).length
  const shown = habits.filter((h) => showArchived || !h.archived)
  const EMPTY = new Map()
  const daily = shown.filter((h) => h.frequency !== 'weekly')
  const weekly = shown.filter((h) => h.frequency === 'weekly')

  return (
    <section>
      <div className="page-head">
        <h1>Analytics</h1>
        {archivedCount > 0 && (
          <label className="toggle">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        )}
      </div>

      <Compare habits={shown} statsById={statsById} protein={protein} />

      <h2 className="section-title">Daily habits</h2>
      <div className="analytics-grid">
        {daily.map((h) => (
          <HabitCard key={h.id} habit={h} logs={logs.get(h.id) ?? EMPTY} s={statsById.get(h.id)} />
        ))}
      </div>

      {weekly.length > 0 && (
        <>
          <h2 className="section-title">Weekly</h2>
          <div className="analytics-grid">
            {weekly.map((h) => (
              <HabitCard key={h.id} habit={h} logs={logs.get(h.id) ?? EMPTY} s={statsById.get(h.id)} />
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Protein</h2>
      <ProteinSummary totals={protein} trackingStart={trackingStart} />

      <h2 className="section-title">Goals</h2>
      <GoalsSummary goals={goals} />
    </section>
  )
}

function GoalsSummary({ goals }) {
  if (!goals) return <p className="muted">Loading…</p>
  if (goals.length === 0)
    return (
      <p className="muted">
        No goals yet. <Link to="/goals">Add one</Link>.
      </p>
    )
  const achieved = goals.filter((g) => g.completed_at)
  return (
    <article className="card stat-card">
      <div className="stat-row">
        {TIERS.map((t) => (
          <div key={t.id} className="stat">
            <span className="stat-value">{goals.filter((g) => g.tier === t.id && !g.completed_at).length}</span>
            <span className="stat-label">Active {t.label.toLowerCase()}</span>
          </div>
        ))}
        <div className="stat">
          <span className="stat-value">{achieved.length}</span>
          <span className="stat-label">Achieved</span>
        </div>
      </div>
      {TIERS.map((t) => {
        const list = goals.filter((g) => g.tier === t.id)
        if (list.length === 0) return null
        return (
          <div key={t.id}>
            <h4 className="chart-title">{t.label}</h4>
            <ul className="dash-goal-list">
              {list.map((g) => (
                <li key={g.id}>
                  <Link to={`/goals/${g.id}`}>
                    <span className="goal-title">{g.title}</span>
                    <GoalProgress goal={g} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </article>
  )
}

const monthLabelFmt = new Intl.DateTimeFormat(undefined, { month: 'short' })

// Side-by-side completion rates per month or per year, oldest → newest.
function Compare({ habits, statsById, protein }) {
  const [mode, setMode] = useState('month')
  const scroller = useRef(null)
  const len = mode === 'month' ? 7 : 4

  // Columns: every period from the earliest tracked data to now.
  const now = todayISO().slice(0, len)
  let first = now
  for (const h of habits) {
    const s = statsById.get(h.id)
    for (const k of (mode === 'month' ? s.monthly : s.yearly).keys()) if (k < first) first = k
  }
  for (const d of protein.keys()) if (d.slice(0, len) < first) first = d.slice(0, len)
  const periods = []
  for (let p = first; p <= now; p = nextPeriod(p)) periods.push(p)

  // Protein per period: average on logged days + days hitting the target.
  const proteinBy = new Map()
  for (const [d, g] of protein) {
    if (g <= 0) continue
    const k = d.slice(0, len)
    const b = proteinBy.get(k) ?? { sum: 0, days: 0, hit: 0 }
    b.sum += g
    b.days++
    if (g >= PROTEIN_MIN) b.hit++
    proteinBy.set(k, b)
  }

  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [mode, periods.length])

  const label = (p) =>
    mode === 'year' ? p : `${monthLabelFmt.format(new Date(+p.slice(0, 4), +p.slice(5) - 1, 1))} ’${p.slice(2, 4)}`

  return (
    <article className="card compare-card">
      <header className="compare-head">
        <h2>Compare</h2>
        <div className="segmented">
          {[
            ['month', 'By month'],
            ['year', 'By year'],
          ].map(([v, l]) => (
            <button key={v} className={mode === v ? 'on' : ''} onClick={() => setMode(v)}>
              {l}
            </button>
          ))}
        </div>
      </header>
      <div className="compare-scroll" ref={scroller}>
        <table className="compare-table">
          <thead>
            <tr>
              <th />
              {periods.map((p) => (
                <th key={p}>{label(p)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habits.map((h) => {
              const s = statsById.get(h.id)
              const buckets = mode === 'month' ? s.monthly : s.yearly
              const unit = s.weekly ? 'weeks' : 'days'
              return (
                <tr key={h.id}>
                  <th scope="row">
                    <span className="dot" style={{ background: h.color }} /> {h.name}
                  </th>
                  {periods.map((p) => {
                    const b = buckets.get(p)
                    return (
                      <td
                        key={p}
                        title={b ? `${b.done} of ${b.total} ${unit}` : 'Not tracked'}
                        style={
                          b
                            ? { background: `color-mix(in srgb, ${h.color} ${Math.round(8 + b.pct * 50)}%, transparent)` }
                            : undefined
                        }
                      >
                        {b ? `${Math.round(b.pct * 100)}%` : <span className="muted">—</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr className="compare-sep">
              <th scope="row">Protein avg</th>
              {periods.map((p) => {
                const b = proteinBy.get(p)
                return (
                  <td key={p} title={b ? `${b.days} days logged` : 'Nothing logged'}>
                    {b ? `${Math.round(b.sum / b.days)}g` : <span className="muted">—</span>}
                  </td>
                )
              })}
            </tr>
            <tr>
              <th scope="row">Days ≥ {PROTEIN_MIN}g</th>
              {periods.map((p) => {
                const b = proteinBy.get(p)
                return (
                  <td key={p} title={b ? `${b.hit} of ${b.days} logged days` : 'Nothing logged'}>
                    {b ? b.hit : <span className="muted">—</span>}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Hover or tap a cell for the exact count. History builds up here automatically — nothing you log is ever
        overwritten.
      </p>
    </article>
  )
}

function nextPeriod(p) {
  if (p.length === 4) return String(+p + 1)
  const y = +p.slice(0, 4)
  const m = +p.slice(5)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

function HabitCard({ habit, logs, s }) {
  const unit = s.weekly ? 'wk' : 'day'
  const plural = (n) => `${n} ${unit}${n === 1 ? '' : 's'}`

  return (
    <article className="card stat-card">
      <header className="stat-head">
        <span className="dot" style={{ background: habit.color }} />
        <h3>{habit.name}</h3>
        {habit.archived && <span className="tag">Archived</span>}
      </header>

      <div className="stat-row">
        {s.windows.map(([label, r]) => (
          <div key={label} className="stat" title={r ? `${r.done} of ${r.total}` : 'Nothing tracked yet'}>
            <span className="stat-value">{pctLabel(r)}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </div>
      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{plural(s.currentStreak)}</span>
          <span className="stat-label">Current streak</span>
        </div>
        <div className="stat">
          <span className="stat-value">{plural(s.longest)}</span>
          <span className="stat-label">Longest streak</span>
        </div>
      </div>

      {s.trend && (
        <>
          <h4 className="chart-title">Weekly completion</h4>
          <TrendBars trend={s.trend} color={habit.color} />
        </>
      )}

      <h4 className="chart-title">Calendar</h4>
      <Heatmap habit={habit} logs={logs} start={s.start} />
    </article>
  )
}

function ProteinSummary({ totals, trackingStart }) {
  const today = todayISO()
  const logged = [...totals.entries()].filter(([, g]) => g > 0)
  const hit = logged.filter(([, g]) => g >= PROTEIN_MIN).length
  const last30 = logged.filter(([d]) => d > addDays(today, -30))
  const avg30 = last30.length ? Math.round(last30.reduce((s, [, g]) => s + g, 0) / last30.length) : null

  return (
    <article className="card stat-card">
      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{logged.length}</span>
          <span className="stat-label">Days logged</span>
        </div>
        <div className="stat">
          <span className="stat-value">{hit}</span>
          <span className="stat-label">Days ≥ {PROTEIN_MIN}g</span>
        </div>
        <div className="stat">
          <span className="stat-value">{logged.length ? `${Math.round((hit / logged.length) * 100)}%` : '—'}</span>
          <span className="stat-label">Hit rate</span>
        </div>
        <div className="stat">
          <span className="stat-value">{avg30 == null ? '—' : `${avg30}g`}</span>
          <span className="stat-label">30-day avg</span>
        </div>
      </div>
      <h4 className="chart-title">Daily totals</h4>
      <ProteinChart totals={totals} min={PROTEIN_MIN} max={PROTEIN_MAX} start={trackingStart} />
    </article>
  )
}
