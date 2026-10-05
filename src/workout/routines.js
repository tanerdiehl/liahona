// Routines (saved templates) and the different ways to start a workout.
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { track } from '../lib/saveStatus'
import { todayISO } from '../lib/dates'
import { defaultWorkoutName, fetchActiveWorkout, fetchPreviousSets, loadSettings, uuid } from './lib'

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
export async function startWorkout({ name, routineId = null, items = [] }) {
  const active = await fetchActiveWorkout()
  if (active) return { id: active.id, existing: true }

  const settings = await loadSettings()
  const unit = settings.weight_unit
  const workoutId = uuid()
  const { error } = await track(
    supabase.from('workouts').insert({
      id: workoutId,
      name: name || defaultWorkoutName(),
      workout_date: todayISO(),
      routine_id: routineId,
    }),
  )
  if (error) throw new Error(`Couldn't start — ${error.message}`)
  if (!items.length) return { id: workoutId }

  const previous = await Promise.all(items.map((it) => fetchPreviousSets(it.exercise_id, workoutId).catch(() => [])))
  const weRows = []
  const setRows = []
  items.forEach((it, position) => {
    const weId = uuid()
    weRows.push({ id: weId, workout_id: workoutId, exercise_id: it.exercise_id, position, notes: it.notes ?? '' })
    const count = Math.max(1, it.sets || previous[position].length || 1)
    for (let i = 0; i < count; i++)
      setRows.push({
        id: uuid(),
        workout_id: workoutId,
        workout_exercise_id: weId,
        exercise_id: it.exercise_id,
        set_order: i,
        set_type: it.setTypes?.[i] ?? previous[position][i]?.set_type ?? 'normal',
        weight_unit: unit,
        distance_unit: unit === 'kg' ? 'km' : 'mi',
        completed: false,
      })
  })
  const r1 = await track(supabase.from('workout_exercises').insert(weRows))
  if (r1.error) throw new Error(`Couldn't add exercises — ${r1.error.message}`)
  const r2 = await track(supabase.from('workout_sets').insert(setRows))
  if (r2.error) throw new Error(`Couldn't add sets — ${r2.error.message}`)
  return { id: workoutId }
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
