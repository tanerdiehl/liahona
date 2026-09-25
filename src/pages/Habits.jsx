import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchHabits, seedIfNeeded } from '../lib/habits'
import { addDays, dateRange, formatShort, fromISO, todayISO, weekdayShort } from '../lib/dates'

const DAYS_SHOWN = 14
const NEXT_STATUS = { none: 'done', done: 'missed', missed: 'none' }
const key = (habitId, date) => `${habitId}|${date}`

export default function Habits({ user }) {
  const today = todayISO()
  const [endDate, setEndDate] = useState(today)
  const [habits, setHabits] = useState(null)
  const [logs, setLogs] = useState({})
  const [expanded, setExpanded] = useState(() => new Set())
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  // Per-cell write queue so rapid taps always land in order and the
  // final saved state matches what's on screen.
  const desired = useRef({})
  const queues = useRef({})

  const startDate = addDays(endDate, -(DAYS_SHOWN - 1))
  const dates = dateRange(startDate, endDate)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        let all = await fetchHabits()
        if (await seedIfNeeded(user, all)) all = await fetchHabits()
        if (!cancelled) setHabits(all.filter((h) => !h.archived))
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const loadLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('habit_logs')
      .select('habit_id,date,status')
      .gte('date', startDate)
      .lte('date', endDate)
    if (error) return setError(error.message)
    const map = {}
    for (const r of data) map[key(r.habit_id, r.date)] = r.status
    setLogs(map)
  }, [startDate, endDate])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // Refresh when returning to the app (e.g. after logging on the phone).
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && loadLogs()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadLogs])

  // On narrow screens, start scrolled to the most recent day.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [habits, endDate])

  function cycle(habitId, date) {
    const k = key(habitId, date)
    const next = NEXT_STATUS[logs[k] ?? 'none']
    setLogs((prev) => {
      const copy = { ...prev }
      if (next === 'none') delete copy[k]
      else copy[k] = next
      return copy
    })
    desired.current[k] = next
    queues.current[k] = (queues.current[k] ?? Promise.resolve()).then(async () => {
      const want = desired.current[k]
      const { error } =
        want === 'none'
          ? await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', date)
          : await supabase
              .from('habit_logs')
              .upsert({ habit_id: habitId, date, status: want, updated_at: new Date().toISOString() })
      if (error) {
        setError(`Couldn't save — ${error.message}`)
        loadLogs()
      }
    })
  }

  function toggleExpanded(id) {
    setExpanded((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  if (error && !habits) return <p className="error">{error}</p>
  if (!habits) return <p className="muted">Loading…</p>

  const atToday = endDate >= today

  return (
    <section>
      <div className="page-head">
        <h1>Habits</h1>
        <Link className="btn ghost" to="/habits/manage">
          Edit habits
        </Link>
      </div>

      <div className="range-nav">
        <button className="btn ghost small" onClick={() => setEndDate(addDays(endDate, -7))} aria-label="Earlier">
          ‹
        </button>
        <span className="muted">
          {formatShort(startDate)} – {formatShort(endDate)}
        </span>
        <button
          className="btn ghost small"
          onClick={() => setEndDate(addDays(endDate, 7) > today ? today : addDays(endDate, 7))}
          disabled={atToday}
          aria-label="Later"
        >
          ›
        </button>
        {!atToday && (
          <button className="btn ghost small" onClick={() => setEndDate(today)}>
            Today
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {habits.length === 0 ? (
        <p className="muted">
          No active habits. <Link to="/habits/manage">Add one</Link>.
        </p>
      ) : (
        <div className="grid-scroll" ref={scrollRef}>
          <table className="habit-grid">
            <thead>
              <tr>
                <th className="habit-col" />
                {dates.map((d) => (
                  <th key={d} className={d === today ? 'is-today' : ''}>
                    <span className="dow">{weekdayShort(d).slice(0, 2)}</span>
                    <span className="dom">{fromISO(d).getDate()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {habits.map((h) => {
                const open = expanded.has(h.id)
                return (
                  <Fragment key={h.id}>
                    <tr>
                      <th className="habit-col" scope="row">
                        <button className="habit-name" onClick={() => toggleExpanded(h.id)} aria-expanded={open}>
                          <span className="dot" style={{ background: h.color }} />
                          <span className="name-text">{h.name}</span>
                          <span className={`chev ${open ? 'open' : ''}`} aria-hidden>
                            ›
                          </span>
                        </button>
                      </th>
                      {dates.map((d) => {
                        const status = logs[key(h.id, d)] ?? 'none'
                        return (
                          <td key={d} className={d === today ? 'is-today' : ''}>
                            <button
                              className={`cell ${status}`}
                              onClick={() => cycle(h.id, d)}
                              aria-label={`${h.name}, ${formatShort(d)}: ${status === 'none' ? 'blank' : status}`}
                            >
                              {status === 'done' ? '✓' : status === 'missed' ? '✕' : ''}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                    {open && (
                      <tr className="detail-row">
                        <td colSpan={dates.length + 1}>
                          <HabitDetail habit={h} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function HabitDetail({ habit }) {
  const fields = [
    ['Why', habit.why],
    ['System', habit.system],
    ['Minimum', habit.minimum],
    ['Stretch', habit.stretch],
  ].filter(([, v]) => v?.trim())

  return (
    <div className="habit-detail" style={{ '--accent': habit.color }}>
      {fields.length === 0 ? (
        <p className="muted">
          Nothing written yet. <Link to="/habits/manage">Add your why</Link>.
        </p>
      ) : (
        <dl>
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
