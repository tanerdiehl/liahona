import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { track } from '../lib/saveStatus'
import { EQUIPMENT, EXERCISE_TYPES, fetchExercises, MUSCLE_GROUPS } from './lib'

// Full-screen sheet: search the library, filter by muscle, or create a
// custom exercise. Calls onPick(exercise).
export default function ExercisePicker({ onPick, onClose, exclude = [] }) {
  const [exercises, setExercises] = useState(null)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchExercises()
      .then(setExercises)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])

  const list = useMemo(() => {
    if (!exercises) return []
    const q = query.trim().toLowerCase()
    return exercises.filter(
      (e) =>
        (!muscle || e.muscle_group === muscle) &&
        (!q || e.name.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q)),
    )
  }, [exercises, query, muscle])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Add exercise" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <button className="link-btn" onClick={onClose}>
            Cancel
          </button>
          <strong>{creating ? 'New exercise' : 'Add exercise'}</strong>
          <button className="link-btn" onClick={() => setCreating(!creating)}>
            {creating ? 'Library' : '+ Custom'}
          </button>
        </header>

        {error && <p className="error">{error}</p>}

        {creating ? (
          <CustomExerciseForm
            initialName={query}
            onCreated={(ex) => {
              setExercises((prev) => [...(prev ?? []), ex])
              onPick(ex)
            }}
          />
        ) : (
          <>
            <input
              type="search"
              className="sheet-search"
              placeholder="Search exercises"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
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
            <ul className="exercise-list">
              {!exercises && <li className="muted">Loading…</li>}
              {exercises && list.length === 0 && (
                <li className="muted">
                  No match.{' '}
                  <button className="link-btn" onClick={() => setCreating(true)}>
                    Create “{query}”
                  </button>
                </li>
              )}
              {list.map((e) => (
                <li key={e.id}>
                  <button onClick={() => onPick(e)} disabled={exclude.includes(e.id)}>
                    <span className="grow">
                      {e.name}
                      {e.is_custom && <span className="tag">Custom</span>}
                    </span>
                    <span className="muted small">{e.muscle_group}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function CustomExerciseForm({ initialName, onCreated }) {
  const [form, setForm] = useState({
    name: initialName,
    muscle_group: 'Chest',
    equipment: 'Barbell',
    exercise_type: 'weight_reps',
  })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    const { data, error } = await track(
      supabase
        .from('exercises')
        .insert({ ...form, name: form.name.trim(), is_custom: true })
        .select()
        .single(),
    )
    if (error)
      return setError(error.code === '23505' ? 'You already have an exercise with that name.' : error.message)
    onCreated(data)
  }

  return (
    <form className="custom-form" onSubmit={submit}>
      <label>
        Name
        <input value={form.name} onChange={set('name')} required autoFocus />
      </label>
      <label>
        Muscle group
        <select value={form.muscle_group} onChange={set('muscle_group')}>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label>
        Equipment
        <select value={form.equipment} onChange={set('equipment')}>
          {EQUIPMENT.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label>
        What you log
        <select value={form.exercise_type} onChange={set('exercise_type')}>
          {Object.entries(EXERCISE_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary">Create and add</button>
    </form>
  )
}
