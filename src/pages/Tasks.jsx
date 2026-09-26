import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { track } from '../lib/saveStatus'
import { formatShort, todayISO, toISO } from '../lib/dates'

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
  const [tasks, setTasks] = useState(null)
  const [goalTitles, setGoalTitles] = useState({})
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showDone, setShowDone] = useState(readShowDone)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    try {
      setTasks(await fetchAll(() => supabase.from('tasks').select('*').order('created_at')))
    } catch (e) {
      setError(e.message)
    }
    // Goal names for the small goal tag; optional.
    const { data } = await supabase.from('goals').select('id,title')
    if (data) setGoalTitles(Object.fromEntries(data.map((g) => [g.id, g.title])))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function mutate(query) {
    const { error } = await track(query)
    setError(error ? `Not saved — ${error.message}` : '')
    await load()
    return !error
  }

  async function add(e) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    // Keep the text in the box until it's safely saved.
    if (await mutate(supabase.from('tasks').insert({ title }))) setDraft('')
    inputRef.current?.focus()
  }

  function setDone(task, done) {
    const completed_at = done ? new Date().toISOString() : null
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed_at } : t)))
    mutate(supabase.from('tasks').update({ completed_at }).eq('id', task.id))
  }

  function rename(task, value) {
    setEditingId(null)
    const title = value.trim()
    if (!title || title === task.title) return
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, title } : t)))
    mutate(supabase.from('tasks').update({ title }).eq('id', task.id))
  }

  function remove(task) {
    if (window.confirm(`Delete "${task.title}"?`)) mutate(supabase.from('tasks').delete().eq('id', task.id))
  }

  function toggleShowDone() {
    const next = !showDone
    setShowDone(next)
    try {
      localStorage.setItem(SHOW_DONE_KEY, String(next))
    } catch {
      /* per-device preference only */
    }
  }

  if (!tasks) return <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>

  const open = tasks.filter((t) => !t.completed_at)
  const done = tasks
    .filter((t) => t.completed_at)
    .sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1))
  const today = todayISO()

  return (
    <section className="narrow">
      <div className="page-head">
        <h1>To-do</h1>
      </div>

      <div className="card keep">
        <ul className="keep-list">
          {open.map((t) => (
            <li key={t.id}>
              <button className="box" onClick={() => setDone(t, true)} aria-label={`Complete ${t.title}`} />
              {editingId === t.id ? (
                <input
                  className="keep-edit"
                  defaultValue={t.title}
                  autoFocus
                  onBlur={(e) => rename(t, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <span className="keep-title" onClick={() => setEditingId(t.id)}>
                  {t.title}
                </span>
              )}
              {goalTitles[t.goal_id] && (
                <Link to={`/goals/${t.goal_id}`} className="chip goal-chip" title="Linked goal">
                  {goalTitles[t.goal_id]}
                </Link>
              )}
              <button className="icon-btn keep-x" onClick={() => remove(t)} aria-label="Delete task">
                ×
              </button>
            </li>
          ))}
          <li className="keep-add">
            <form onSubmit={add}>
              <span className="plus" aria-hidden>
                +
              </span>
              <input
                ref={inputRef}
                placeholder="List item"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="New task"
              />
            </form>
          </li>
        </ul>

        {error && <p className="error">{error}</p>}

        {done.length > 0 && (
          <>
            <button className="keep-done-toggle" onClick={toggleShowDone} aria-expanded={showDone}>
              <span className={`chev ${showDone ? 'open' : ''}`} aria-hidden>
                ›
              </span>
              {done.length} Completed item{done.length === 1 ? '' : 's'}
            </button>
            {showDone && (
              <ul className="keep-list done">
                {done.map((t) => {
                  const day = toISO(new Date(t.completed_at))
                  return (
                    <li key={t.id}>
                      <button className="box on" onClick={() => setDone(t, false)} aria-label={`Uncheck ${t.title}`}>
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
    </section>
  )
}
