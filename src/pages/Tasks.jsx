import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { formatLong, todayISO, toISO } from '../lib/dates'

export default function Tasks() {
  const [open, setOpen] = useState(null)
  const [done, setDone] = useState([])
  const [title, setTitle] = useState('')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [openRows, doneRows] = await Promise.all([
        fetchAll(() =>
          supabase.from('tasks').select('*').is('completed_at', null).order('created_at', { ascending: false }),
        ),
        fetchAll(() =>
          supabase
            .from('tasks')
            .select('*')
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false }),
        ),
      ])
      setOpen(openRows)
      setDone(doneRows)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function mutate(promise) {
    const { error } = await promise
    setError(error ? error.message : '')
    await load()
  }

  async function add(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    setTitle('')
    await mutate(supabase.from('tasks').insert({ title: t }))
    inputRef.current?.focus()
  }

  function complete(task) {
    setOpen((prev) => prev.filter((t) => t.id !== task.id))
    mutate(supabase.from('tasks').update({ completed_at: new Date().toISOString() }).eq('id', task.id))
  }

  function reopen(task) {
    mutate(supabase.from('tasks').update({ completed_at: null }).eq('id', task.id))
  }

  function rename(task, newTitle) {
    setEditingId(null)
    const t = newTitle.trim()
    if (!t || t === task.title) return
    mutate(supabase.from('tasks').update({ title: t }).eq('id', task.id))
  }

  function remove(task) {
    if (window.confirm(`Delete "${task.title}"? It won't appear in your done log.`))
      mutate(supabase.from('tasks').delete().eq('id', task.id))
  }

  // Done log, filtered by keyword and grouped by local completion date.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = []
    for (const t of done) {
      if (q && !t.title.toLowerCase().includes(q)) continue
      const day = toISO(new Date(t.completed_at))
      if (out.length === 0 || out[out.length - 1].day !== day) out.push({ day, tasks: [] })
      out[out.length - 1].tasks.push(t)
    }
    return out
  }, [done, query])

  const today = todayISO()

  return (
    <section className="narrow">
      <div className="page-head">
        <h1>To-do</h1>
      </div>

      <form className="quick-add" onSubmit={add}>
        <input
          ref={inputRef}
          placeholder="Add a task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="New task"
        />
        <button className="btn primary">Add</button>
      </form>
      {error && <p className="error">{error}</p>}

      {open === null ? (
        <p className="muted">Loading…</p>
      ) : open.length === 0 ? (
        <p className="muted empty">All clear.</p>
      ) : (
        <ul className="task-list card">
          {open.map((t) => (
            <li key={t.id}>
              <button className="check" onClick={() => complete(t)} aria-label={`Complete ${t.title}`} />
              {editingId === t.id ? (
                <input
                  className="inline-edit"
                  defaultValue={t.title}
                  autoFocus
                  onBlur={(e) => rename(t, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <span className="task-title" onClick={() => setEditingId(t.id)}>
                  {t.title}
                </span>
              )}
              <button className="icon-btn" onClick={() => remove(t)} aria-label="Delete task">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="done-head">
        <h2 className="section-title">Done</h2>
        <span className="muted small">{done.length} completed</span>
      </div>
      <input
        type="search"
        placeholder="Search everything you've done…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search done tasks"
      />

      {groups.length === 0 ? (
        <p className="muted">{query ? 'No matches.' : 'Completed tasks will collect here.'}</p>
      ) : (
        groups.map((g) => (
          <div key={g.day} className="done-group">
            <h3>{g.day === today ? 'Today' : formatLong(g.day)}</h3>
            <ul className="task-list done">
              {g.tasks.map((t) => (
                <li key={t.id}>
                  <button className="check on" onClick={() => reopen(t)} aria-label={`Reopen ${t.title}`}>
                    ✓
                  </button>
                  <span className="task-title">{t.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
