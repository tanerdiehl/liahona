import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { bigCelebration, toast } from '../lib/celebrate'
import {
  convertWeight,
  EXERCISE_TYPES,
  fetchPreviousSets,
  formatDuration,
  loadSettings,
  parseDuration,
  roundWeight,
  SET_TYPE_CYCLE,
  SET_TYPES,
  uuid,
  workoutSeconds,
} from './lib'
import { useNow } from './useNow'
import { readWorkoutCache } from './workoutCache'
import { cacheWorkout, discardWorkout, isDirty, saveWorkoutLocal, syncSoon, useWorkoutSync } from './workoutSync'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ExercisePicker from './ExercisePicker'
import { warmupSets } from './warmup'
import { suggestWeight } from './suggest'
import WorkoutSummary from './WorkoutSummary'

// /workout/:id — the live logger while a workout is open, the summary once
// it's finished.
export default function WorkoutPage() {
  const { id } = useParams()
  const location = useLocation()
  const [workout, setWorkout] = useState(undefined)
  // A just-created past workout opens straight into the editor.
  const [editing, setEditing] = useState(Boolean(location.state?.edit))
  const [error, setError] = useState('')

  const [savedOffline, setSavedOffline] = useState(false)

  // Uses this device's copy when it has changes that haven't uploaded yet,
  // or when there's no connection.
  const load = useCallback(async () => {
    const cached = readWorkoutCache(id)
    if (cached?.workout && isDirty(id)) {
      // Finished but still uploading: the summary needs the server's copy.
      if (cached.workout.ended_at && !location.state?.edit) setSavedOffline(true)
      return setWorkout(cached.workout)
    }
    const { data, error } = await supabase.from('workouts').select('*').eq('id', id).maybeSingle()
    if (error) {
      if (cached?.workout) setWorkout(cached.workout)
      else setError(`Couldn't load this workout — ${error.message}`)
    } else setWorkout(data)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (savedOffline)
    return (
      <section className="narrow">
        <div className="card offline-done">
          <h1>Workout saved ✓</h1>
          <p>
            It's saved on this phone and still uploading (slow or no signal). It keeps trying on its own until it's
            in — nothing is lost if you close the app.
          </p>
          <Link to="/workout" className="btn primary">
            Back to workouts
          </Link>
        </div>
      </section>
    )
  if (error) return <p className="error">{error}</p>
  if (workout === undefined) return <p className="muted">Loading…</p>
  if (workout === null)
    return (
      <p className="muted">
        Workout not found. <Link to="/workout">Back to workouts</Link>
      </p>
    )
  if (workout.ended_at && !editing)
    return (
      <WorkoutSummary
        workout={workout}
        justFinished={sessionStorage.getItem('liahona.justFinished') === id}
        onEdit={() => setEditing(true)}
      />
    )
  // A finished workout opens in the same editor, in edit mode.
  return (
    <ActiveWorkout
      key={workout.id + (editing ? '-edit' : '')}
      workout={workout}
      editing={Boolean(workout.ended_at)}
      onFinished={async (opts) => {
        if (opts?.offline) return setSavedOffline(true)
        await load()
        setEditing(false)
      }}
    />
  )
}

// Fields each exercise type needs before a set can be checked off.
const REQUIRED = {
  weight_reps: ['weight', 'reps'],
  bodyweight_reps: ['reps'],
  weighted_bodyweight: ['reps'],
  assisted_bodyweight: ['reps'],
  duration: ['duration_seconds'],
  distance_duration: ['duration_seconds'],
}

function ActiveWorkout({ workout, editing, onFinished }) {
  const navigate = useNavigate()
  const now = useNow(1000)
  const [unit, setUnit] = useState('lbs')
  const [exercises, setExercises] = useState({})
  const [entries, setEntries] = useState(null) // [{ we, sets, previous }]
  const [name, setName] = useState(workout.name)
  const [notes, setNotes] = useState(workout.notes)
  const [showNotes, setShowNotes] = useState(Boolean(workout.notes))
  const [picker, setPicker] = useState(false)
  const [error, setError] = useState('')
  const [finishing, setFinishing] = useState(false)
  // Start/end times, editable when fixing a past workout.
  const [times, setTimes] = useState({
    workout_date: workout.workout_date,
    started_at: workout.started_at,
    ended_at: workout.ended_at,
  })
  const previousBefore = editing ? workout.started_at : null
  // Targets from the routine this workout was started from, by exercise.
  const [targets, setTargets] = useState({})
  useEffect(() => {
    if (!workout.routine_id) return
    supabase
      .from('routine_exercises')
      .select('id,exercise_id,target_sets,target_reps,rest_seconds')
      .eq('routine_id', workout.routine_id)
      .then(({ data }) => data && setTargets(Object.fromEntries(data.map((t) => [t.exercise_id, t]))))
  }, [workout.routine_id])

  // ---------- load ----------
  useEffect(() => {
    ;(async () => {
      const cached = readWorkoutCache(workout.id)
      const applyCache = (c) => {
        setUnit(c.unit ?? 'lbs')
        setExercises(c.exercises ?? {})
        if (c.targets) setTargets(c.targets)
        setEntries(c.entries ?? [])
      }
      // Unsynced changes on this phone are newer than the server's copy.
      if (cached?.entries && isDirty(workout.id)) return applyCache(cached)
      try {
        const [settings, { data: ex, error: e1 }, { data: wes, error: e2 }, { data: sets, error: e3 }] =
          await Promise.all([
            loadSettings(),
            supabase.from('exercises').select('*'),
            supabase.from('workout_exercises').select('*').eq('workout_id', workout.id).order('position'),
            supabase.from('workout_sets').select('*').eq('workout_id', workout.id).order('set_order'),
          ])
        if (e1 || e2 || e3) throw e1 || e2 || e3
        setUnit(settings.weight_unit)
        setExercises(Object.fromEntries(ex.map((e) => [e.id, e])))
        const previous = await Promise.all(
          wes.map((we) => fetchPreviousSets(we.exercise_id, workout.id, previousBefore).catch(() => [])),
        )
        setEntries(
          wes.map((we, i) => ({ we, sets: sets.filter((s) => s.workout_exercise_id === we.id), previous: previous[i] })),
        )
      } catch (e) {
        if (cached?.entries) applyCache(cached)
        else setError(`Couldn't load — ${e.message}`)
      }
    })()
  }, [workout.id])

  // ---------- saving ----------
  // Every change is saved on this phone instantly, and the whole workout
  // uploads in the background (see workoutSync.js) — so bad gym signal
  // never loses anything, and there's nothing to wait for.
  const sync = useWorkoutSync()
  const snapshot = () => {
    const used = Object.fromEntries(entries.map((e) => [e.we.exercise_id, exercises[e.we.exercise_id]]))
    return { workout: { ...workout, ...times, name, notes }, entries, exercises: used, targets, unit }
  }
  const loaded = useRef(false)
  const closed = useRef(false)
  useEffect(() => {
    if (!entries || closed.current) return
    // Opening a workout just keeps a copy; only real changes upload.
    if (!loaded.current) {
      loaded.current = true
      if (!isDirty(workout.id)) return cacheWorkout(workout.id, snapshot())
    }
    saveWorkoutLocal(workout.id, snapshot())
  }, [entries, name, notes, times]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateSet(weId, setId, fields) {
    setEntries((prev) =>
      prev.map((e) =>
        e.we.id === weId ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...fields } : s)) } : e,
      ),
    )
  }

  // ---------- sets ----------
  function newSet(we, order, setType = 'normal') {
    return {
      id: uuid(),
      workout_id: workout.id,
      workout_exercise_id: we.id,
      exercise_id: we.exercise_id,
      set_order: order,
      set_type: setType,
      weight: null,
      weight_unit: unit,
      reps: null,
      duration_seconds: null,
      distance: null,
      distance_unit: unit === 'kg' ? 'km' : 'mi',
      completed: false,
    }
  }

  function addSet(entry) {
    const s = newSet(entry.we, Math.max(-1, ...entry.sets.map((x) => x.set_order)) + 1)
    setEntries((prev) => prev.map((e) => (e.we.id === entry.we.id ? { ...e, sets: [...e.sets, s] } : e)))
  }

  function removeSet(entry, set) {
    setEntries((prev) =>
      prev.map((e) => (e.we.id === entry.we.id ? { ...e, sets: e.sets.filter((x) => x.id !== set.id) } : e)),
    )
  }

  // Adds warm-up sets (marked W) ahead of the working sets.
  function addWarmups(entry, list) {
    const first = Math.min(0, ...entry.sets.map((s) => s.set_order))
    const rows = list.map((w, i) => ({
      ...newSet(entry.we, first - list.length + i, 'warmup'),
      weight: w.weight,
      reps: w.reps,
    }))
    setEntries((prev) => prev.map((e) => (e.we.id === entry.we.id ? { ...e, sets: [...rows, ...e.sets] } : e)))
  }

  // The fields that mark a set done: empty boxes take last session's numbers
  // (the grey ghosts). Returns null if it still has nothing to record.
  function doneFields(entry, set, index, stamp) {
    const type = exercises[entry.we.exercise_id]?.exercise_type ?? 'weight_reps'
    const ghost = ghostFor(entry, index)
    const fields = { completed: true, completed_at: stamp }
    if (ghost) {
      if (set.weight == null && ghost.weight != null)
        fields.weight = roundWeight(convertWeight(Number(ghost.weight), ghost.weight_unit, set.weight_unit))
      if (set.reps == null && ghost.reps != null) fields.reps = ghost.reps
      if (set.duration_seconds == null && ghost.duration_seconds != null)
        fields.duration_seconds = ghost.duration_seconds
      if (set.distance == null && ghost.distance != null) fields.distance = Number(ghost.distance)
    }
    const missing = REQUIRED[type].filter((f) => (fields[f] ?? set[f]) == null)
    return missing.length ? null : fields
  }

  // When editing a past workout, sets are dated to that workout, not today.
  const stampNow = () => (editing ? times.ended_at : new Date().toISOString())

  function toggleComplete(entry, set, index) {
    if (set.completed) return updateSet(entry.we.id, set.id, { completed: false, completed_at: null })
    const fields = doneFields(entry, set, index, stampNow())
    if (!fields) {
      const type = exercises[entry.we.exercise_id]?.exercise_type ?? 'weight_reps'
      const need = REQUIRED[type].map((f) => f.replace('_seconds', '')).join(' and ')
      toast({ title: 'Fill in the set first', body: `Needs ${need}.` })
      return
    }
    updateSet(entry.we.id, set.id, fields)
  }

  function cycleSetType(entry, set) {
    const next = SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(set.set_type) + 1) % SET_TYPE_CYCLE.length]
    updateSet(entry.we.id, set.id, { set_type: next })
  }

  // ---------- exercises ----------
  async function addExercise(ex) {
    setPicker(false)
    setExercises((prev) => ({ ...prev, [ex.id]: ex }))
    const we = {
      id: uuid(),
      workout_id: workout.id,
      exercise_id: ex.id,
      position: Math.max(-1, ...entries.map((e) => e.we.position)) + 1,
      notes: '',
    }
    const previous = await fetchPreviousSets(ex.id, workout.id, previousBefore).catch(() => [])
    const sets = Array.from({ length: Math.max(1, previous.length) }, (_, i) =>
      newSet(we, i, previous[i]?.set_type ?? 'normal'),
    )
    setEntries((prev) => [...prev, { we, sets, previous }])
  }

  // Drag-and-drop: move an exercise, then renumber everyone's position.
  function reorderExercises(activeId, overId) {
    const from = entries.findIndex((e) => e.we.id === activeId)
    const to = entries.findIndex((e) => e.we.id === overId)
    if (from < 0 || to < 0 || from === to) return
    const moved = arrayMove(entries, from, to)
    setEntries(moved.map((e, i) => ({ ...e, we: { ...e.we, position: i } })))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function removeExercise(entry) {
    const ex = exercises[entry.we.exercise_id]
    if (!window.confirm(`Remove ${ex?.name ?? 'this exercise'} and its sets from this workout?`)) return
    setEntries((prev) => prev.filter((e) => e.we.id !== entry.we.id))
  }

  function saveExerciseNotes(entry, value) {
    if (value === entry.we.notes) return
    setEntries((prev) => prev.map((e) => (e.we.id === entry.we.id ? { ...e, we: { ...e.we, notes: value } } : e)))
  }

  // ---------- finish / discard ----------
  // No questions: every set you checked off or typed numbers into is kept
  // (unchecked ones count as done); untouched empty sets are dropped.
  async function finish() {
    const stamp = stampNow()
    const typed = (s) => s.weight != null || s.reps != null || s.duration_seconds != null || s.distance != null
    const kept = entries
      .map((e) => ({
        ...e,
        sets: e.sets
          .map((s, i) => {
            if (s.completed) return s
            if (!typed(s)) return null
            const fields = doneFields(e, s, i, stamp)
            return fields ? { ...s, ...fields } : null
          })
          .filter(Boolean),
      }))
      .filter((e) => e.sets.length)
    if (!kept.length) {
      if (window.confirm('Nothing has been logged in this workout. Discard it?')) discard(true)
      return
    }
    closed.current = true
    setFinishing(true)
    const snap = snapshot()
    saveWorkoutLocal(workout.id, {
      ...snap,
      entries: kept,
      workout: { ...snap.workout, ended_at: editing ? times.ended_at : stamp },
    })
    if (!editing) bigCelebration()
    // Usually uploads in under a second. If the signal's bad, it keeps
    // trying in the background — the workout is already safe on the phone.
    const synced = await syncSoon(4000)
    setFinishing(false)
    if (!synced) return onFinished({ offline: true })
    if (!editing) sessionStorage.setItem('liahona.justFinished', workout.id)
    onFinished()
  }

  function discard(skipConfirm) {
    if (!skipConfirm && !window.confirm('Discard this workout? Everything logged in it will be deleted.')) return
    closed.current = true
    discardWorkout(workout.id)
    navigate('/workout')
  }

  if (!entries) return <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>

  const doneSets = entries.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0)

  return (
    <section className="narrow active-workout">
      <header className="aw-head">
        <div className="aw-title">
          <input
            className="title-input"
            value={name}
            placeholder="Workout name"
            onChange={(e) => setName(e.target.value)}
            aria-label="Workout name"
          />
          <span className="aw-meta">
            <span className="timer">⏱ {formatDuration(workoutSeconds({ ...workout, ...times }, now))}</span>
            <span className="muted small">{doneSets} sets done</span>
          </span>
        </div>
        <button className="btn primary" onClick={finish} disabled={finishing}>
          {finishing ? 'Saving…' : editing ? 'Done' : 'Finish'}
        </button>
      </header>

      {editing && <WhenEditor times={times} onSave={setTimes} />}

      {error && <p className="error">{error}</p>}
      {sync.pending > 0 && sync.error && (
        <div className="aw-offline">📶 Saved on this phone. It'll upload by itself when the connection is back.</div>
      )}

      {showNotes ? (
        <textarea
          className="aw-notes"
          rows={2}
          placeholder="Workout notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      ) : (
        <button className="link-btn" onClick={() => setShowNotes(true)}>
          + Workout notes
        </button>
      )}

      {entries.length === 0 && <p className="empty-quip">Add your first exercise to get going.</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => over && reorderExercises(active.id, over.id)}
      >
        <SortableContext items={entries.map((e) => e.we.id)} strategy={verticalListSortingStrategy}>
      {entries.map((entry) => (
        <ExerciseCard
          key={entry.we.id}
          entry={entry}
          exercise={exercises[entry.we.exercise_id]}
          target={targets[entry.we.exercise_id]}
          onAddWarmups={(list) => addWarmups(entry, list)}
          editing={editing}
          onUpdate={(set, fields) => updateSet(entry.we.id, set.id, fields)}
          onToggle={(set, i) => toggleComplete(entry, set, i)}
          onCycleType={(set) => cycleSetType(entry, set)}
          onAddSet={() => addSet(entry)}
          onRemoveSet={(set) => removeSet(entry, set)}
          onRemove={() => removeExercise(entry)}
          onNotes={(v) => saveExerciseNotes(entry, v)}
        />
      ))}
        </SortableContext>
      </DndContext>

      <button className="btn add-exercise" onClick={() => setPicker(true)}>
        + Add exercise
      </button>
      {editing ? (
        <p className="muted small center">Editing a past workout. Changes save as you go.</p>
      ) : (
        <button className="link-btn discard" onClick={() => discard(false)}>
          Discard workout
        </button>
      )}

      {picker && (
        <ExercisePicker
          onPick={addExercise}
          onClose={() => setPicker(false)}
          exclude={entries.map((e) => e.we.exercise_id)}
        />
      )}
    </section>
  )
}

function ExerciseCard({ entry, exercise, target, onAddWarmups, editing, onUpdate, onToggle, onCycleType, onAddSet, onRemoveSet, onRemove, onNotes }) {
  const [showNotes, setShowNotes] = useState(Boolean(entry.we.notes))
  const [notes, setNotes] = useState(entry.we.notes)
  const type = exercise?.exercise_type ?? 'weight_reps'
  const cfg = EXERCISE_TYPES[type]
  const [warmOpen, setWarmOpen] = useState(false)
  let workingNumber = 0
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.we.id,
  })

  return (
    <article
      ref={setNodeRef}
      className={`card exercise-card ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <header className="ex-head">
        <button
          ref={setActivatorNodeRef}
          className="drag-handle"
          aria-label={`Reorder ${exercise?.name ?? 'exercise'}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className="grow">
          <h3>{exercise?.name ?? 'Exercise'}</h3>
          <span className="muted small">
            {exercise?.muscle_group}
            {target && (
              <span className="target-hint">
                {' '}
                · Target {target.target_sets}
                {target.target_reps ? ` × ${target.target_reps}` : ' sets'}
              </span>
            )}
          </span>
        </div>
        {type === 'weight_reps' && (
          <button className="link-btn" onClick={() => setWarmOpen(!warmOpen)}>
            Warm up
          </button>
        )}
        {!showNotes && (
          <button className="link-btn" onClick={() => setShowNotes(true)}>
            Note
          </button>
        )}
        <button className="icon-btn" onClick={onRemove} aria-label="Remove exercise">
          ×
        </button>
      </header>
      {showNotes && (
        <input
          className="ex-notes"
          placeholder="Notes for this exercise"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => onNotes(notes)}
        />
      )}

      {!editing && type === 'weight_reps' && <Suggestion entry={entry} target={target} equipment={exercise?.equipment} />}

      {warmOpen && (
        <WarmupPanel
          entry={entry}
          equipment={exercise?.equipment}
          onAdd={(list) => {
            onAddWarmups(list)
            setWarmOpen(false)
          }}
          onClose={() => setWarmOpen(false)}
        />
      )}

      <div className={`set-grid cols-${cfg.fields.length}`}>
        <div className="set-row head">
          <span>Set</span>
          <span>Previous</span>
          {cfg.fields.map((f) => (
            <span key={f}>{fieldLabel(f, cfg, entry.sets[0])}</span>
          ))}
          <span aria-label="Done">✓</span>
          <span />
        </div>

        {entry.sets.map((set, i) => {
          const ghost = ghostFor(entry, i)
          const label = SET_TYPES[set.set_type].short ?? String(++workingNumber)
          return (
            <div key={set.id} className={`set-row ${set.completed ? 'done' : ''}`}>
              <button
                className={`set-num t-${set.set_type}`}
                onClick={() => onCycleType(set)}
                title={`${SET_TYPES[set.set_type].label} — tap to change`}
              >
                {label}
              </button>
              <span className="prev">{ghost ? formatSet(ghost, type, set.weight_unit) : '—'}</span>
              {cfg.fields.map((f) => (
                <FieldInput key={f} field={f} set={set} ghost={ghost} onChange={(fields) => onUpdate(set, fields)} />
              ))}
              <button
                className={`set-check ${set.completed ? 'on' : ''}`}
                onClick={() => onToggle(set, i)}
                aria-label={set.completed ? 'Mark set not done' : 'Mark set done'}
              >
                ✓
              </button>
              <button className="set-x" onClick={() => onRemoveSet(set)} aria-label="Remove set">
                ×
              </button>
            </div>
          )
        })}
      </div>
      <button className="btn ghost small add-set" onClick={onAddSet}>
        + Add set
      </button>
    </article>
  )
}

function fieldLabel(field, cfg, sampleSet) {
  const unit = sampleSet?.weight_unit ?? 'lbs'
  if (field === 'weight') return `${cfg.weightLabel ?? ''}${unit}`
  if (field === 'reps') return 'Reps'
  if (field === 'duration') return 'Time'
  if (field === 'distance') return sampleSet?.distance_unit ?? 'mi'
  return field
}

function formatSet(s, type, unit) {
  const w = s.weight != null ? roundWeight(convertWeight(Number(s.weight), s.weight_unit, unit)) : null
  switch (type) {
    case 'weight_reps':
      return `${w ?? 0} × ${s.reps ?? 0}`
    case 'weighted_bodyweight':
      return `+${w ?? 0} × ${s.reps ?? 0}`
    case 'assisted_bodyweight':
      return `−${w ?? 0} × ${s.reps ?? 0}`
    case 'bodyweight_reps':
      return `${s.reps ?? 0} reps`
    case 'duration':
      return formatDuration(s.duration_seconds)
    case 'distance_duration':
      return `${s.distance ?? 0} ${s.distance_unit} · ${formatDuration(s.duration_seconds)}`
    default:
      return ''
  }
}

// One input cell. Keeps its own text so half-typed values like "22." work;
// the last session's number shows as grey placeholder text.
function FieldInput({ field, set, ghost, onChange }) {
  if (field === 'duration')
    return (
      <DurationInput
        value={set.duration_seconds}
        placeholder={ghost ? formatDuration(ghost.duration_seconds) : '0:00'}
        onChange={(v) => onChange({ duration_seconds: v })}
      />
    )
  return <NumberInput field={field} set={set} ghost={ghost} onChange={onChange} />
}

function NumberInput({ field, set, ghost, onChange }) {
  const column = field
  const value = set[column]
  const toText = (v) => (v == null ? '' : field === 'duration' ? formatDuration(v) : String(v))
  const [text, setText] = useState(toText(value))
  const lastValue = useRef(value)

  // Accept outside changes (e.g. ghost values filled in on check-off).
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value
      setText(toText(value))
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  let placeholder = ''
  if (ghost) {
    if (field === 'weight' && ghost.weight != null)
      placeholder = String(roundWeight(convertWeight(Number(ghost.weight), ghost.weight_unit, set.weight_unit)))
    else if (field === 'duration') placeholder = formatDuration(ghost.duration_seconds)
    else if (ghost[column] != null) placeholder = String(Number(ghost[column]))
  }

  function parse(t) {
    const s = t.trim().replace(',', '.')
    if (!s) return null
    if (field === 'duration') return parseDuration(s)
    const n = field === 'reps' ? parseInt(s, 10) : Number(s)
    return isNaN(n) || n < 0 ? undefined : n
  }

  return (
    <input
      className="set-input"
      inputMode={field === 'reps' ? 'numeric' : field === 'duration' ? 'text' : 'decimal'}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setText(e.target.value)
        const v = parse(e.target.value)
        if (v !== undefined && v !== value) {
          lastValue.current = v
          onChange({ [column]: v })
        }
      }}
      aria-label={field}
    />
  )
}

// Time entry like a microwave: digits fill in from the right, on the number
// keypad. 45 → 0:45, 130 → 1:30, 1000 → 10:00, 10000 → 1:00:00.
function DurationInput({ value, placeholder, onChange }) {
  const [digits, setDigits] = useState(toDigits(value))
  const lastValue = useRef(value)

  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value
      setDigits(toDigits(value))
    }
  }, [value])

  return (
    <input
      className="set-input"
      inputMode="numeric"
      placeholder={placeholder}
      value={formatDigits(digits)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const d = e.target.value.replace(/D/g, '').replace(/^0+/, '').slice(0, 6)
        setDigits(d)
        const secs = d ? digitsToSeconds(d) : null
        if (secs !== value) {
          lastValue.current = secs
          onChange(secs)
        }
      }}
      // Tidy "0:90" into "1:30" when you leave the box.
      onBlur={() => setDigits(toDigits(value))}
      aria-label="time"
    />
  )
}

const pad2 = (n) => String(n).padStart(2, '0')

function toDigits(secs) {
  if (secs == null) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return (h ? `${h}${pad2(m)}${pad2(s)}` : `${m}${pad2(s)}`).replace(/^0+/, '')
}

function digitsToSeconds(d) {
  const p = d.padStart(6, '0')
  return Number(p.slice(0, 2)) * 3600 + Number(p.slice(2, 4)) * 60 + Number(p.slice(4))
}

function formatDigits(d) {
  if (!d) return ''
  const p = d.padStart(3, '0')
  const sec = p.slice(-2)
  const rest = p.slice(0, -2)
  if (rest.length <= 2) return `${Number(rest)}:${sec}`
  return `${Number(rest.slice(0, -2))}:${rest.slice(-2)}:${sec}`
}

// Date + start/end time for a past workout. An end time earlier than the
// start is treated as after midnight.
function WhenEditor({ times, onSave }) {
  const toTime = (iso) => {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const [date, setDate] = useState(times.workout_date)
  const [start, setStart] = useState(toTime(times.started_at))
  const [end, setEnd] = useState(toTime(times.ended_at))

  function commit() {
    if (!date || !start || !end) return
    const s = new Date(`${date}T${start}`)
    const e = new Date(`${date}T${end}`)
    if (e < s) e.setDate(e.getDate() + 1)
    const next = { workout_date: date, started_at: s.toISOString(), ended_at: e.toISOString() }
    const changed =
      next.workout_date !== times.workout_date ||
      new Date(next.started_at).getTime() !== new Date(times.started_at).getTime() ||
      new Date(next.ended_at).getTime() !== new Date(times.ended_at).getTime()
    if (changed) onSave(next)
  }

  return (
    <div className="when-editor">
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} onBlur={commit} />
      </label>
      <label>
        Start
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} onBlur={commit} />
      </label>
      <label>
        End
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} onBlur={commit} />
      </label>
    </div>
  )
}

// Last session's matching set: the k-th warm-up lines up with the k-th
// warm-up from last time, the k-th working set with the k-th working set,
// so adding warm-ups doesn't shift the grey numbers.
function ghostFor(entry, index) {
  const isWarm = (s) => s.set_type === 'warmup'
  const set = entry.sets[index]
  const same = entry.sets.slice(0, index).filter((s) => isWarm(s) === isWarm(set)).length
  return entry.previous.filter((s) => isWarm(s) === isWarm(set))[same]
}

function WarmupPanel({ entry, equipment, onAdd, onClose }) {
  const unit = entry.sets[0]?.weight_unit ?? 'lbs'
  // Start from this workout's first working weight, or last time's.
  const firstWorking = entry.sets.find((s) => s.set_type !== 'warmup' && s.weight != null)
  const lastTime = entry.previous.find((s) => s.set_type !== 'warmup' && s.weight != null)
  const initial = firstWorking
    ? Number(firstWorking.weight)
    : lastTime
      ? roundWeight(convertWeight(Number(lastTime.weight), lastTime.weight_unit, unit))
      : ''
  const [working, setWorking] = useState(String(initial))
  const list = warmupSets(Number(working), unit, equipment)

  return (
    <div className="warmup-panel">
      <label>
        Working weight ({unit})
        <input
          className="set-input"
          inputMode="decimal"
          value={working}
          onChange={(e) => setWorking(e.target.value.replace(',', '.'))}
          autoFocus
        />
      </label>
      {list.length ? (
        <ol className="warmup-list">
          {list.map((w, i) => (
            <li key={i}>
              <span className="set-num t-warmup">W</span>
              {w.weight} {unit} × {w.reps}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted small">Enter your working weight to see warm-up sets.</p>
      )}
      <div className="form-actions">
        <button className="btn ghost small" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary small" disabled={!list.length} onClick={() => onAdd(list)}>
          Add {list.length} warm-up set{list.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  )
}

// A hint for today's working weight, from last session (and routine target).
function Suggestion({ entry, target, equipment }) {
  const [open, setOpen] = useState(false)
  if (!entry.previous.length) return null
  const unit = entry.sets[0]?.weight_unit ?? 'lbs'
  const s = suggestWeight({ previous: entry.previous, targetReps: target?.target_reps, unit, equipment })
  if (!s) return null
  return (
    <button className="suggestion" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span aria-hidden>💡</span>
      <span>
        {s.main}
        {open && <span className="muted small suggestion-detail">{s.detail}</span>}
      </span>
    </button>
  )
}

