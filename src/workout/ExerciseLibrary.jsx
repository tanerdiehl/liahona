import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { track } from '../lib/saveStatus'
import { EQUIPMENT, EXERCISE_TYPES, MUSCLE_GROUPS } from './lib'
import { CustomExerciseForm } from './ExercisePicker'

// /workout/library — every exercise: search, filter, edit, archive, add.
export default function ExerciseLibrary() {
  const navigate = useNavigate()
  const [exercises, setExercises] = useState(null)
  const [counts, setCounts] = useState({})
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [openId, setOpenId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const [ex, sets] = await Promise.all([
        fetchAll(() => supabase.from('exercises').select('*').order('name')),
        fetchAll(() => supabase.from('workout_sets').select('exercise_id').eq('completed', true).order('id')),
      ])
      const c = {}
      for (const s of sets) c[s.exercise_id] = (c[s.exercise_id] ?? 0) + 1
      setExercises(ex)
      setCounts(c)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const list = useMemo(() => {
    if (!exercises) return []
    const q = query.trim().toLowerCase()
    return exercises.filter(
      (e) =>
        e.archived === showArchived &&
        (!muscle || e.muscle_group === muscle) &&
        (!q || e.name.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q)),
    )
  }, [exercises, query, muscle, showArchived])

  async function save(ex, fields) {
    setExercises((prev) => prev.map((e) => (e.id === ex.id ? { ...e, ...fields } : e)))
    const { error } = await track(supabase.from('exercises').update(fields).eq('id', ex.id))
    if (error) {
      setError(error.code === '23505' ? 'You already have an exercise with that name.' : `Not saved — ${error.message}`)
      load()
    } else setError('')
  }

  if (!exercises) return <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>

  return (
    <section className="narrow library">
      <div className="page-head">
        <Link to="/workout" className="btn ghost small">
          ‹ Workouts
        </Link>
        <button className="btn primary small" onClick={() => setAdding(!adding)}>
          {adding ? 'Cancel' : '+ New exercise'}
        </button>
      </div>
      <h1>Exercises</h1>

      {adding && (
        <div className="card">
          <CustomExerciseForm
            initialName={query}
            submitLabel="Create exercise"
            onCreated={(ex) => {
              setExercises((prev) => [...prev, ex].sort((a, b) => a.name.localeCompare(b.name)))
              setAdding(false)
              setOpenId(ex.id)
            }}
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <input
        type="search"
        placeholder={`Search ${exercises.filter((e) => !e.archived).length} exercises`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="library-search"
      />
      <div className="chip-scroll">
        <button className={`chip-btn ${!muscle ? 'on' : ''}`} onClick={() => setMuscle('')}>
          All
        </button>
        {MUSCLE_GROUPS.map((m) => (
          <button key={m} className={`chip-btn ${muscle === m ? 'on' : ''}`} onClick={() => setMuscle(m)}>
            {m}
          </button>
        ))}
      </div>

      <ul className="card library-list">
        {list.length === 0 && <li className="muted small pad">No exercises match.</li>}
        {list.map((e) => {
          const n = counts[e.id] ?? 0
          const open = openId === e.id
          return (
            <li key={e.id}>
              <button className="library-row" onClick={() => setOpenId(open ? null : e.id)} aria-expanded={open}>
                <span className="grow">
                  {e.name}
                  {e.is_custom && <span className="tag">Custom</span>}
                  <span className="muted small library-meta">
                    {e.muscle_group} · {e.equipment} · {EXERCISE_TYPES[e.exercise_type]?.label}
                  </span>
                </span>
                <span className="muted small">{n ? `${n} sets` : ''}</span>
              </button>
              {open && (
                <div className="library-edit">
                  <label>
                    Name
                    <NameInput value={e.name} onSave={(name) => save(e, { name })} />
                  </label>
                  <div className="library-selects">
                    <label>
                      Muscle
                      <select value={e.muscle_group} onChange={(ev) => save(e, { muscle_group: ev.target.value })}>
                        {MUSCLE_GROUPS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Equipment
                      <select value={e.equipment} onChange={(ev) => save(e, { equipment: ev.target.value })}>
                        {[...new Set([...EQUIPMENT, e.equipment])].map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Logs
                      <select
                        value={e.exercise_type}
                        disabled={n > 0}
                        title={n > 0 ? "Can't change once you've logged sets" : ''}
                        onChange={(ev) => save(e, { exercise_type: ev.target.value })}
                      >
                        {Object.entries(EXERCISE_TYPES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-actions">
                    {n > 0 && (
                      <button
                        className="btn ghost small"
                        onClick={() => navigate('/workout/progress', { state: { exerciseId: e.id } })}
                      >
                        📈 Progress
                      </button>
                    )}
                    <span className="grow" />
                    <button className="btn ghost small" onClick={() => save(e, { archived: !e.archived })}>
                      {e.archived ? 'Restore' : 'Archive'}
                    </button>
                  </div>
                  {!e.archived && (
                    <p className="muted small">Archiving hides it from the exercise picker. Its history stays.</p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <button className="link-btn show-archived" onClick={() => setShowArchived(!showArchived)}>
        {showArchived ? '‹ Back to exercises' : `Archived (${exercises.filter((e) => e.archived).length})`}
      </button>
    </section>
  )
}

function NameInput({ value, onSave }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v.trim() !== value && onSave(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}
