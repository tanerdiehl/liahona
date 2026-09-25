import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchHabits, PALETTE } from '../lib/habits'

const EMPTY = { name: '', color: PALETTE[0].value, why: '', system: '', minimum: '', stretch: '' }

export default function ManageHabits() {
  const [habits, setHabits] = useState(null)
  const [editingId, setEditingId] = useState(null) // habit id, 'new', or null
  const [error, setError] = useState('')

  async function reload() {
    try {
      setHabits(await fetchHabits())
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  async function run(promise) {
    const { error } = await promise
    if (error) setError(error.message)
    else setError('')
    await reload()
    return !error
  }

  async function save(form) {
    const fields = {
      name: form.name.trim(),
      color: form.color,
      why: form.why,
      system: form.system,
      minimum: form.minimum,
      stretch: form.stretch,
    }
    const ok =
      editingId === 'new'
        ? await run(
            supabase.from('habits').insert({
              ...fields,
              sort_order: Math.max(-1, ...habits.map((h) => h.sort_order)) + 1,
            }),
          )
        : await run(supabase.from('habits').update(fields).eq('id', editingId))
    if (ok) setEditingId(null)
  }

  // Swap with the neighbour, then renumber the whole list 0..n so
  // sort_order never drifts or collides.
  async function move(habit, dir) {
    const list = [...habits]
    const i = list.findIndex((h) => h.id === habit.id)
    let j = i + dir
    while (list[j] && list[j].archived !== habit.archived) j += dir
    if (!list[j]) return
    ;[list[i], list[j]] = [list[j], list[i]]
    const changed = list
      .map((h, idx) => ({ ...h, sort_order: idx }))
      .filter((h) => habits.find((o) => o.id === h.id).sort_order !== h.sort_order)
    setHabits(list)
    await Promise.all(
      changed.map((h) => supabase.from('habits').update({ sort_order: h.sort_order }).eq('id', h.id)),
    )
    await reload()
  }

  async function remove(habit) {
    const ok = window.confirm(
      `Delete "${habit.name}" permanently?\n\nThis also deletes every check-in you've recorded for it. ` +
        `If you just want to stop tracking it, use Archive instead — that keeps the history.`,
    )
    if (ok) await run(supabase.from('habits').delete().eq('id', habit.id))
  }

  if (!habits) return <p className="muted">{error || 'Loading…'}</p>

  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)

  return (
    <section className="narrow">
      <div className="page-head">
        <h1>Edit habits</h1>
        <Link className="btn ghost" to="/habits">
          Done
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      <ul className="habit-list">
        {active.map((h, i) => (
          <li key={h.id} className="card">
            {editingId === h.id ? (
              <HabitForm initial={h} onSave={save} onCancel={() => setEditingId(null)} />
            ) : (
              <div className="habit-row">
                <span className="dot" style={{ background: h.color }} />
                <span className="grow">{h.name}</span>
                <button className="icon-btn" onClick={() => move(h, -1)} disabled={i === 0} aria-label="Move up">
                  ↑
                </button>
                <button
                  className="icon-btn"
                  onClick={() => move(h, 1)}
                  disabled={i === active.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button className="btn ghost small" onClick={() => setEditingId(h.id)}>
                  Edit
                </button>
                <button
                  className="btn ghost small"
                  onClick={() => run(supabase.from('habits').update({ archived: true }).eq('id', h.id))}
                >
                  Archive
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {editingId === 'new' ? (
        <div className="card">
          <HabitForm initial={EMPTY} onSave={save} onCancel={() => setEditingId(null)} />
        </div>
      ) : (
        <button className="btn primary" onClick={() => setEditingId('new')}>
          + Add habit
        </button>
      )}

      {archived.length > 0 && (
        <>
          <h2 className="section-title">Archived</h2>
          <p className="muted small">Hidden from the grid. History is kept.</p>
          <ul className="habit-list">
            {archived.map((h) => (
              <li key={h.id} className="card archived">
                <div className="habit-row">
                  <span className="dot" style={{ background: h.color }} />
                  <span className="grow">{h.name}</span>
                  <button
                    className="btn ghost small"
                    onClick={() => run(supabase.from('habits').update({ archived: false }).eq('id', h.id))}
                  >
                    Restore
                  </button>
                  <button className="btn ghost small danger" onClick={() => remove(h)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function HabitForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    await onSave(form)
    setBusy(false)
  }

  return (
    <form className="habit-form" onSubmit={submit}>
      <label>
        Name
        <input value={form.name} onChange={set('name')} required autoFocus />
      </label>

      <fieldset>
        <legend>Color</legend>
        <div className="swatches">
          {PALETTE.map((p) => (
            <button
              type="button"
              key={p.value}
              className={`swatch ${form.color === p.value ? 'selected' : ''}`}
              style={{ background: p.value }}
              onClick={() => setForm({ ...form, color: p.value })}
              aria-label={p.name}
              title={p.name}
            />
          ))}
          <input type="color" value={form.color} onChange={set('color')} aria-label="Custom color" />
        </div>
      </fieldset>

      <label>
        Why
        <textarea rows={2} value={form.why} onChange={set('why')} />
      </label>
      <label>
        System
        <textarea rows={2} value={form.system} onChange={set('system')} />
      </label>
      <label>
        Minimum
        <textarea rows={2} value={form.minimum} onChange={set('minimum')} />
      </label>
      <label>
        Stretch
        <textarea rows={2} value={form.stretch} onChange={set('stretch')} />
      </label>

      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
