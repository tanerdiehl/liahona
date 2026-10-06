import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { track } from '../lib/saveStatus'
import { fetchRoutineData, startFromRoutine } from './routines'
import ExercisePicker from './ExercisePicker'
import { formatRest, REST_CHOICES } from './restTimer'

// /workout/routine/:id — edit a routine. Everything saves as you go.
export default function RoutineEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [routine, setRoutine] = useState(null)
  const [folders, setFolders] = useState([])
  const [picker, setPicker] = useState(false)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  const load = useCallback(async () => {
    try {
      const { folders, routines } = await fetchRoutineData()
      const r = routines.find((x) => x.id === id)
      if (!r) return setError('Routine not found.')
      setFolders(folders)
      setRoutine(r)
    } catch (e) {
      setError(e.message)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function write(query) {
    const { error } = await track(query)
    setError(error ? `Not saved — ${error.message}` : '')
    return !error
  }

  function saveRoutine(fields) {
    setRoutine((r) => ({ ...r, ...fields }))
    return write(supabase.from('routines').update(fields).eq('id', id))
  }

  function saveItem(item, fields) {
    setRoutine((r) => ({
      ...r,
      routine_exercises: r.routine_exercises.map((x) => (x.id === item.id ? { ...x, ...fields } : x)),
    }))
    return write(supabase.from('routine_exercises').update(fields).eq('id', item.id))
  }

  async function addExercise(ex) {
    setPicker(false)
    const position = Math.max(-1, ...routine.routine_exercises.map((x) => x.position)) + 1
    const { data, error } = await track(
      supabase
        .from('routine_exercises')
        .insert({ routine_id: id, exercise_id: ex.id, position, target_sets: 3, target_reps: '8–12' })
        .select('*, exercises(name, muscle_group, exercise_type)')
        .single(),
    )
    if (error) return setError(`Not saved — ${error.message}`)
    setRoutine((r) => ({ ...r, routine_exercises: [...r.routine_exercises, data] }))
  }

  async function removeItem(item) {
    setRoutine((r) => ({ ...r, routine_exercises: r.routine_exercises.filter((x) => x.id !== item.id) }))
    await write(supabase.from('routine_exercises').delete().eq('id', item.id))
  }

  function reorder(activeId, overId) {
    const list = routine.routine_exercises
    const from = list.findIndex((x) => x.id === activeId)
    const to = list.findIndex((x) => x.id === overId)
    if (from < 0 || to < 0 || from === to) return
    const moved = arrayMove(list, from, to).map((x, i) => ({ ...x, position: i }))
    setRoutine((r) => ({ ...r, routine_exercises: moved }))
    moved
      .filter((x) => list.find((o) => o.id === x.id).position !== x.position)
      .forEach((x) => write(supabase.from('routine_exercises').update({ position: x.position }).eq('id', x.id)))
  }

  async function start() {
    setStarting(true)
    try {
      const res = await startFromRoutine(routine)
      if (res.existing && !window.confirm('You already have a workout in progress. Go to it?')) return
      navigate(`/workout/${res.id}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the routine "${routine.name}"? Workouts you've done with it are kept.`)) return
    if (await write(supabase.from('routines').delete().eq('id', id))) navigate('/workout')
  }

  if (!routine) return <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>

  return (
    <section className="narrow routine-editor">
      <div className="page-head">
        <Link to="/workout" className="btn ghost small">
          ‹ Workouts
        </Link>
        <button className="btn primary" onClick={start} disabled={starting || !routine.routine_exercises.length}>
          {starting ? 'Starting…' : '▶ Start'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card form-card">
        <BlurInput
          className="title-input"
          value={routine.name}
          onSave={(name) => name.trim() && saveRoutine({ name: name.trim() })}
          aria-label="Routine name"
        />
        <label>
          Folder
          <select
            className="ex-select"
            value={routine.folder_id ?? ''}
            onChange={(e) => saveRoutine({ folder_id: e.target.value || null })}
          >
            <option value="">No folder</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notes
          <BlurInput textarea rows={2} value={routine.notes} onSave={(notes) => saveRoutine({ notes })} />
        </label>
      </div>

      <h2 className="section-title">Exercises</h2>
      {routine.routine_exercises.length === 0 && <p className="muted">Add the exercises this routine includes.</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => over && reorder(active.id, over.id)}
      >
        <SortableContext items={routine.routine_exercises.map((x) => x.id)} strategy={verticalListSortingStrategy}>
          <ul className="routine-items">
            {routine.routine_exercises.map((item) => (
              <RoutineItem key={item.id} item={item} onSave={saveItem} onRemove={removeItem} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <button className="btn add-exercise" onClick={() => setPicker(true)}>
        + Add exercise
      </button>
      <button className="link-btn discard" onClick={remove}>
        Delete routine
      </button>

      {picker && (
        <ExercisePicker
          onPick={addExercise}
          onClose={() => setPicker(false)}
          exclude={routine.routine_exercises.map((x) => x.exercise_id)}
        />
      )}
    </section>
  )
}

function RoutineItem({ item, onSave, onRemove }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const timed = ['duration', 'distance_duration'].includes(item.exercises?.exercise_type)
  return (
    <li
      ref={setNodeRef}
      className={`card routine-item ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button ref={setActivatorNodeRef} className="drag-handle" aria-label="Reorder" {...attributes} {...listeners}>
        ⠿
      </button>
      <div className="grow">
        <strong>{item.exercises?.name}</strong>
        <span className="muted small"> {item.exercises?.muscle_group}</span>
        <div className="targets">
          <label>
            Sets
            <BlurInput
              className="target-input"
              inputMode="numeric"
              value={String(item.target_sets)}
              onSave={(v) => {
                const n = parseInt(v, 10)
                if (n > 0 && n < 50) onSave(item, { target_sets: n })
              }}
            />
          </label>
          <span className="times">×</span>
          <label>
            {timed ? 'Time' : 'Reps'}
            <BlurInput
              className="target-input wide"
              value={item.target_reps}
              placeholder={timed ? '0:45' : '8–12'}
              onSave={(v) => onSave(item, { target_reps: v.trim() })}
            />
          </label>
          <label>
            Rest
            <select
              className="target-select"
              value={item.rest_seconds ?? ''}
              onChange={(e) => onSave(item, { rest_seconds: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">Default</option>
              {REST_CHOICES.map((s) => (
                <option key={s} value={s}>
                  {s ? formatRest(s) : 'Off'}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <button className="icon-btn" onClick={() => onRemove(item)} aria-label="Remove exercise">
        ×
      </button>
    </li>
  )
}

// Text field that saves when you leave it (or press Enter for single-line).
function BlurInput({ value, onSave, textarea, ...rest }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  const props = {
    ...rest,
    value: v,
    onChange: (e) => setV(e.target.value),
    onBlur: () => v !== (value ?? '') && onSave(v),
  }
  return textarea ? (
    <textarea {...props} />
  ) : (
    <input {...props} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  )
}
