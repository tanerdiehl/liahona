import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTasks } from '../lib/useTasks'
import { formatShort, todayISO, toISO } from '../lib/dates'
import { pickForDay, TODO_EMPTY } from '../lib/quips'
import TaskList from '../components/TaskList'

const SHOW_DONE_KEY = 'liahona.todo.showDone'

function readShowDone() {
  try {
    return localStorage.getItem(SHOW_DONE_KEY) !== 'false'
  } catch {
    return true
  }
}

// Google Keep-style checklist. Completed items stay forever, struck
// through, under a collapsible "Completed items" section.
export default function Tasks() {
  const api = useTasks()
  const [goalTitles, setGoalTitles] = useState({})
  const [showDone, setShowDone] = useState(readShowDone)
  const today = todayISO()

  useEffect(() => {
    // Goal names for the small goal tag; optional.
    supabase
      .from('goals')
      .select('id,title')
      .then(({ data }) => data && setGoalTitles(Object.fromEntries(data.map((g) => [g.id, g.title]))))
  }, [])

  function toggleShowDone() {
    const next = !showDone
    setShowDone(next)
    try {
      localStorage.setItem(SHOW_DONE_KEY, String(next))
    } catch {
      /* per-device preference only */
    }
  }

  if (!api.tasks) return <p className={api.error ? 'error' : 'muted'}>{api.error || 'Loading…'}</p>

  return (
    <section className="narrow">
      <div className="page-head">
        <h1>To-do</h1>
      </div>

      <div className="card keep">
        {api.open.length === 0 && <p className="empty-quip">{pickForDay(TODO_EMPTY, today)}</p>}
        <TaskList api={api} goalTitles={goalTitles} />
        {api.error && <p className="error">{api.error}</p>}

        {api.done.length > 0 && (
          <>
            <button className="keep-done-toggle" onClick={toggleShowDone} aria-expanded={showDone}>
              <span className={`chev ${showDone ? 'open' : ''}`} aria-hidden>
                ›
              </span>
              {api.done.length} Completed item{api.done.length === 1 ? '' : 's'}
            </button>
            {showDone && (
              <ul className="keep-list done">
                {api.done.map((t) => {
                  const day = toISO(new Date(t.completed_at))
                  return (
                    <li key={t.id}>
                      <button className="box on" onClick={() => api.reopen(t)} aria-label={`Uncheck ${t.title}`}>
                        ✓
                      </button>
                      <span className="keep-title">{t.title}</span>
                      <span className="keep-date">
                        {day === today
                          ? 'Today'
                          : formatShort(day) + (day.slice(0, 4) !== today.slice(0, 4) ? `, ${day.slice(0, 4)}` : '')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
      <p className="muted small hint">Drag ⠿ to reorder. Tap an item to edit it.</p>
    </section>
  )
}
