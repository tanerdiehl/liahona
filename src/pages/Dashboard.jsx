import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchHabits, seedIfNeeded } from '../lib/habits'
import { fetchGoals } from '../lib/goals'
import { track } from '../lib/saveStatus'
import { formatLong, startOfWeek, todayISO } from '../lib/dates'
import GoalProgress from '../components/GoalProgress'
import TaskList from '../components/TaskList'
import { useTasks } from '../lib/useTasks'
import { celebrateHabit } from '../lib/celebrate'
import { DAILY, pickForDay, TODO_EMPTY } from '../lib/quips'
import { PROTEIN_MAX, PROTEIN_MIN } from './Protein'

const NEXT_STATUS = { none: 'done', done: 'missed', missed: 'none' }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// Calm, at-a-glance home. Each section can fail on its own without
// taking the rest of the page down.
export default function Dashboard({ user }) {
  const today = todayISO()
  return (
    <section className="dashboard">
      <div className="page-head dash-head">
        <div>
          <p className="muted small">{formatLong(today)}</p>
          <h1>{greeting()}</h1>
          <p className="daily-quip">{pickForDay(DAILY, today)}</p>
        </div>
      </div>
      <div className="dash-grid">
        <TodayHabits user={user} />
        <RememberWhy />
        <ProteinToday />
        <TasksPanel />
        <GoalsPeek />
        <JournalPeek />
      </div>
    </section>
  )
}

function Panel({ title, to, linkLabel = 'Open', children, className = '' }) {
  return (
    <article className={`card dash-card ${className}`}>
      <header className="dash-card-head">
        <h2>{title}</h2>
        <Link to={to} className="dash-link">
          {linkLabel} ›
        </Link>
      </header>
      {children}
    </article>
  )
}

function TodayHabits({ user }) {
  const today = todayISO()
  const week = startOfWeek(today)
  const [habits, setHabits] = useState(null)
  const [logs, setLogs] = useState({})
  const [error, setError] = useState('')
  const desired = useRef({})
  const queues = useRef({})

  const load = useCallback(async () => {
    try {
      let all = await fetchHabits()
      if (await seedIfNeeded(user, all)) all = await fetchHabits()
      const { data, error } = await supabase
        .from('habit_logs')
        .select('habit_id,date,status')
        .in('date', [today, week])
      if (error) throw error
      const map = {}
      for (const h of all) {
        const d = h.frequency === 'weekly' ? week : today
        const row = data.find((r) => r.habit_id === h.id && r.date === d)
        if (row) map[h.id] = row.status
      }
      setHabits(all.filter((h) => !h.archived))
      setLogs(map)
    } catch (e) {
      setError(e.message)
    }
  }, [user, today, week])

  useEffect(() => {
    load()
  }, [load])

  function cycle(h, el) {
    const date = h.frequency === 'weekly' ? week : today
    const next = NEXT_STATUS[logs[h.id] ?? 'none']
    if (next === 'done') {
      const daily = habits.filter((x) => x.frequency !== 'weekly')
      const allDone = h.frequency !== 'weekly' && daily.every((x) => x.id === h.id || logs[x.id] === 'done')
      celebrateHabit(h, el, { allDone, colors: habits.map((x) => x.color) })
    }
    setLogs((prev) => {
      const copy = { ...prev }
      if (next === 'none') delete copy[h.id]
      else copy[h.id] = next
      return copy
    })
    desired.current[h.id] = next
    queues.current[h.id] = (queues.current[h.id] ?? Promise.resolve()).then(async () => {
      const want = desired.current[h.id]
      const { error } = await track(
        want === 'none'
          ? supabase.from('habit_logs').delete().eq('habit_id', h.id).eq('date', date)
          : supabase
              .from('habit_logs')
              .upsert({ habit_id: h.id, date, status: want, updated_at: new Date().toISOString() }),
      )
      if (error) {
        setError(`Not saved — ${error.message}`)
        load()
      }
    })
  }

  const doneCount = habits ? habits.filter((h) => logs[h.id] === 'done').length : 0

  return (
    <Panel title="Today" to="/habits" linkLabel="All habits" className="dash-habits">
      {error && <p className="error">{error}</p>}
      {!habits ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <p className="muted small">
            {doneCount} of {habits.length} done
          </p>
          <ul className="today-list">
            {habits.map((h) => {
              const s = logs[h.id] ?? 'none'
              return (
                <li key={h.id}>
                  <button
                    className={`cell ${s}`}
                    onClick={(e) => cycle(h, e.currentTarget)}
                    aria-label={`${h.name}: ${s === 'none' ? 'blank' : s}`}
                  >
                    {s === 'done' ? '✓' : s === 'missed' ? '✕' : ''}
                  </button>
                  <span className="dot" style={{ background: h.color }} />
                  <span className="grow">{h.name}</span>
                  {h.frequency === 'weekly' && <span className="tag">This week</span>}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Panel>
  )
}

function ProteinToday() {
  const today = todayISO()
  const [total, setTotal] = useState(null)
  const [grams, setGrams] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('protein_entries').select('grams').eq('date', today)
    if (error) return setError(error.message)
    setTotal(Math.round(data.reduce((s, r) => s + Number(r.grams), 0) * 10) / 10)
  }, [today])

  useEffect(() => {
    load()
  }, [load])

  async function add(e) {
    e.preventDefault()
    const n = Number(grams.replace(',', '.'))
    if (!(n > 0 && n < 1000)) return setError('Enter grams between 1 and 999.')
    const { error } = await track(
      supabase.from('protein_entries').insert({ date: today, grams: Math.round(n * 10) / 10 }),
    )
    if (error) return setError(`Not saved — ${error.message}`)
    setError('')
    setGrams('')
    load()
  }

  const t = total ?? 0
  const scale = Math.max(200, t)
  const status =
    t === 0
      ? `Target ${PROTEIN_MIN}–${PROTEIN_MAX}g`
      : t < PROTEIN_MIN
        ? `${Math.round(PROTEIN_MIN - t)}g to go`
        : t <= PROTEIN_MAX
          ? 'In range'
          : 'Above range'

  return (
    <Panel title="Protein" to="/protein" linkLabel="History" className="dash-protein">
      <div className="protein-total">
        <span className="big">{total ?? '—'}</span>
        <span className="muted">g · {status}</span>
      </div>
      <div className="protein-bar">
        <span
          className="band"
          style={{ left: `${(PROTEIN_MIN / scale) * 100}%`, width: `${((PROTEIN_MAX - PROTEIN_MIN) / scale) * 100}%` }}
        />
        <span className={`fill ${t >= PROTEIN_MIN ? 'hit' : ''}`} style={{ width: `${(t / scale) * 100}%` }} />
      </div>
      <form className="quick-add" onSubmit={add}>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Add grams"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          aria-label="Grams of protein"
        />
        <button className="btn primary">Add</button>
      </form>
      {error && <p className="error">{error}</p>}
    </Panel>
  )
}

function TasksPanel() {
  const api = useTasks()
  const today = todayISO()
  const LIMIT = 7
  const more = api.open.length - LIMIT

  return (
    <Panel title="To-do" to="/todo" linkLabel={more > 0 ? `All ${api.open.length}` : 'Open'} className="dash-tasks">
      {!api.tasks ? (
        <p className={api.error ? 'error' : 'muted'}>{api.error || 'Loading…'}</p>
      ) : (
        <>
          {api.open.length === 0 && <p className="empty-quip">{pickForDay(TODO_EMPTY, today)}</p>}
          <TaskList api={api} limit={LIMIT} compact />
          {more > 0 && (
            <Link to="/todo" className="muted small">
              + {more} more
            </Link>
          )}
          {api.error && <p className="error">{api.error}</p>}
        </>
      )}
    </Panel>
  )
}

// One habit's "why" each day, so the reasons stay front of mind.
function RememberWhy() {
  const [habit, setHabit] = useState(null)

  useEffect(() => {
    fetchHabits()
      .then((all) => {
        const withWhy = all.filter((h) => !h.archived && h.why?.trim())
        if (withWhy.length) setHabit(pickForDay(withWhy, todayISO()))
      })
      .catch(() => {})
  }, [])

  if (!habit) return null
  return (
    <article className="card dash-card why-card" style={{ '--accent': habit.color }}>
      <header className="dash-card-head">
        <h2>Remember why</h2>
        <span className="chip">
          <span className="dot" style={{ background: habit.color }} /> {habit.name}
        </span>
      </header>
      <p className="why-text">{habit.why}</p>
      {(habit.minimum || habit.stretch) && (
        <dl className="why-range">
          {habit.minimum && (
            <div>
              <dt>Minimum</dt>
              <dd>{habit.minimum}</dd>
            </div>
          )}
          {habit.stretch && (
            <div>
              <dt>Stretch</dt>
              <dd>{habit.stretch}</dd>
            </div>
          )}
        </dl>
      )}
    </article>
  )
}

function GoalsPeek() {
  const [goals, setGoals] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchGoals()
      .then((g) => setGoals(g.filter((x) => !x.completed_at)))
      .catch((e) => setError(e.message))
  }, [])

  return (
    <Panel title="Goals" to="/goals" linkLabel="All goals" className="dash-goals">
      {error ? (
        <p className="error">{error}</p>
      ) : !goals ? (
        <p className="muted">Loading…</p>
      ) : goals.length === 0 ? (
        <p className="muted">
          No goals yet. <Link to="/goals">Add one</Link>.
        </p>
      ) : (
        <ul className="dash-goal-list">
          {goals.slice(0, 6).map((g) => (
            <li key={g.id}>
              <Link to={`/goals/${g.id}`}>
                <span className="goal-title">{g.title}</span>
                <GoalProgress goal={g} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function JournalPeek() {
  const [entry, setEntry] = useState(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('journal_entries')
      .select('entry_date,body')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => (error ? setError(error.message) : setEntry(data[0] ?? null)))
  }, [])

  return (
    <Panel title="Journal" to="/journal" linkLabel="Write" className="dash-journal">
      {error ? (
        <p className="error">{error}</p>
      ) : entry === undefined ? (
        <p className="muted">Loading…</p>
      ) : entry === null ? (
        <p className="muted">No entries yet.</p>
      ) : (
        <Link to="/journal" className="journal-peek">
          <span className="muted small">{formatLong(entry.entry_date)}</span>
          <span className="journal-excerpt">{entry.body}</span>
        </Link>
      )}
    </Panel>
  )
}
