// Routines (saved templates) and the different ways to start a workout.
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { track } from '../lib/saveStatus'
import { todayISO } from '../lib/dates'
import { defaultWorkoutName, fetchActiveWorkout, fetchPreviousSets, loadSettings, uuid } from './lib'
import { localActiveWorkout, saveWorkoutLocal } from './workoutSync'

export async function fetchRoutineData() {
  const [folders, routines] = await Promise.all([
    fetchAll(() => supabase.from('routine_folders').select('*').order('sort_order').order('created_at')),
    fetchAll(() =>
      supabase
        .from('routines')
        .select('*, routine_exercises(*, exercises(name, muscle_group, exercise_type))')
        .order('sort_order')
        .order('created_at'),
    ),
  ])
  for (const r of routines) r.routine_exercises.sort((a, b) => a.position - b.position)
  return { folders, routines }
}

// Creates a workout pre-filled with exercises and empty sets (last
// session's numbers show as grey ghosts, as usual). items:
// [{ exercise_id, sets: n, setTypes?: [...], notes? }]
// If a workout is already in progress, returns that one instead.
// It's created on this phone first and uploads in the background, so it
// starts instantly even with no signal.
export async function startWorkout({ name, routineId = null, items = [], past = null }) {
  if (!past) {
    const active = await fetchActiveWorkout().catch(() => localActiveWorkout())
    if (active) return { id: active.id, existing: true }
  }

  const settings = await loadSettings().catch(() => ({ weight_unit: 'lbs' }))
  const unit = settings.weight_unit ?? 'lbs'
  const workoutId = uuid()
  const workout = {
    id: workoutId,
    name: name || defaultWorkoutName(past ? new Date(past.started_at) : new Date()),
    notes: '',
    workout_date: past?.workout_date ?? todayISO(),
    started_at: past?.started_at ?? new Date().toISOString(),
    ended_at: past?.ended_at ?? null,
    routine_id: routineId,
  }

  const ids = items.map((it) => it.exercise_id)
  const [previous, exercises] = await Promise.all([
    Promise.all(items.map((it) => fetchPreviousSets(it.exercise_id, workoutId, past?.started_at).catch(() => []))),
    ids.length
      ? supabase
          .from('exercises')
          .select('*')
          .in('id', ids)
          .then(({ data }) => Object.fromEntries((data ?? []).map((e) => [e.id, e])))
          .catch(() => ({}))
      : {},
  ])
  const entries = items.map((it, position) => {
    const we = { id: uuid(), workout_id: workoutId, exercise_id: it.exercise_id, position, notes: it.notes ?? '' }
    const count = Math.max(1, it.sets || previous[position].length || 1)
    const sets = Array.from({ length: count }, (_, i) => ({
      id: uuid(),
      workout_id: workoutId,
      workout_exercise_id: we.id,
      exercise_id: it.exercise_id,
      set_order: i,
      set_type: it.setTypes?.[i] ?? previous[position][i]?.set_type ?? 'normal',
      weight: null,
      weight_unit: unit,
      reps: null,
      duration_seconds: null,
      distance: null,
      distance_unit: unit === 'kg' ? 'km' : 'mi',
      completed: false,
    }))
    return { we, sets, previous: previous[position] }
  })
  saveWorkoutLocal(workoutId, { workout, entries, exercises, targets: {}, unit }, { now: true })
  return { id: workoutId }
}

// A workout you did earlier but didn't log: opens in the editor with the
// date and times you picked.
export function logPastWorkout({ date, start, end }) {
  const s = new Date(`${date}T${start}`)
  const e = new Date(`${date}T${end}`)
  if (e <= s) e.setDate(e.getDate() + 1)
  return startWorkout({ past: { workout_date: date, started_at: s.toISOString(), ended_at: e.toISOString() } })
}

export function startFromRoutine(routine) {
  return startWorkout({
    name: routine.name,
    routineId: routine.id,
    items: routine.routine_exercises.map((re) => ({ exercise_id: re.exercise_id, sets: re.target_sets })),
  })
}

async function workoutOutline(workoutId) {
  const [{ data: wes, error: e1 }, { data: sets, error: e2 }] = await Promise.all([
    supabase.from('workout_exercises').select('*').eq('workout_id', workoutId).order('position'),
    supabase
      .from('workout_sets')
      .select('workout_exercise_id,set_order,set_type,reps,completed')
      .eq('workout_id', workoutId)
      .order('set_order'),
  ])
  if (e1 || e2) throw e1 || e2
  return wes.map((we) => ({ we, sets: sets.filter((s) => s.workout_exercise_id === we.id && s.completed) }))
}

// "Repeat": same exercises, same number and type of sets.
export async function repeatWorkout(workout) {
  const outline = await workoutOutline(workout.id)
  return startWorkout({
    name: workout.name,
    routineId: workout.routine_id,
    items: outline.map(({ we, sets }) => ({
      exercise_id: we.exercise_id,
      sets: sets.length,
      setTypes: sets.map((s) => s.set_type),
    })),
  })
}

// Turns a finished workout into a routine: one entry per exercise with its
// working-set count and the rep range you did.
export async function saveWorkoutAsRoutine(workout) {
  const outline = await workoutOutline(workout.id)
  const routineId = uuid()
  const r = await track(
    supabase.from('routines').insert({ id: routineId, name: workout.name || 'New routine' }),
  )
  if (r.error) throw new Error(r.error.message)
  const rows = outline.map(({ we, sets }, position) => {
    const working = sets.filter((s) => s.set_type !== 'warmup')
    const reps = working.map((s) => s.reps).filter((n) => n > 0)
    const lo = Math.min(...reps)
    const hi = Math.max(...reps)
    return {
      routine_id: routineId,
      exercise_id: we.exercise_id,
      position,
      target_sets: Math.max(1, working.length || sets.length),
      target_reps: reps.length ? (lo === hi ? `${lo}` : `${lo}–${hi}`) : '',
    }
  })
  if (rows.length) {
    const r2 = await track(supabase.from('routine_exercises').insert(rows))
    if (r2.error) throw new Error(r2.error.message)
  }
  return routineId
}
