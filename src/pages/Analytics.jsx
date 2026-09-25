import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll, fetchHabits } from '../lib/habits'
import { habitStats, pctLabel } from '../lib/stats'
import { addDays, todayISO } from '../lib/dates'
import { Heatmap, ProteinChart, TrendBars } from '../components/Charts'
import { PROTEIN_MAX, PROTEIN_MIN } from './Protein'

export default function Analytics() {
  const [habits, setHabits] = useState(null)
  const [logs, setLogs] = useState(null) // Map habitId -> Map(date -> status)
  const [protein, setProtein] = useState(null) // Map date -> total grams
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [h, logRows, proteinRows] = await Promise.all([
          fetchHabits(),
          fetchAll(() => supabase.from('habit_logs').select('habit_id,date,status').order('date')),
          fetchAll(() => supabase.from('protein_entries').select('date,grams').order('date')),
        ])
        const byHabit = new Map()
        for (const r of logRows) {
          if (!byHabit.has(r.habit_id)) byHabit.set(r.habit_id, new Map())
          byHabit.get(r.habit_id).set(r.date, r.status)
        }
        const totals = new Map()
        for (const r of proteinRows) totals.set(r.date, (totals.get(r.date) ?? 0) + Number(r.grams))
        setHabits(h)
        setLogs(byHabit)
        setProtein(totals)
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!habits) return <p className="muted">Loading…</p>

  const archivedCount = habits.filter((h) => h.archived).length
  const shown = habits.filter((h) => showArchived || !h.archived)
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

      <div className="analytics-grid">
        {daily.map((h) => (
          <HabitCard key={h.id} habit={h} logs={logs.get(h.id) ?? new Map()} />
        ))}
      </div>

      {weekly.length > 0 && (
        <>
          <h2 className="section-title">Weekly</h2>
          <div className="analytics-grid">
            {weekly.map((h) => (
              <HabitCard key={h.id} habit={h} logs={logs.get(h.id) ?? new Map()} />
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Protein</h2>
      <ProteinSummary totals={protein} />
    </section>
  )
}

function HabitCard({ habit, logs }) {
  const s = useMemo(() => habitStats(habit, logs), [habit, logs])
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

      <h4 className="chart-title">{s.weekly ? 'Last 52 weeks' : 'Last 12 months'}</h4>
      <Heatmap habit={habit} logs={logs} start={s.start} />
    </article>
  )
}

function ProteinSummary({ totals }) {
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
      <h4 className="chart-title">Daily totals, last 60 days</h4>
      <ProteinChart totals={totals} min={PROTEIN_MIN} max={PROTEIN_MAX} />
    </article>
  )
}
