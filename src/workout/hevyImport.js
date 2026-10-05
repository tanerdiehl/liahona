// Import a Hevy "workout_data.csv" export.
// - Every Hevy set becomes its own workout_sets row (nothing summarised).
// - Hevy names that match your library are merged into it, so old sessions
//   count toward "last time" and PRs; the rest become custom exercises.
// - Workouts whose start time already exists are skipped, so importing a
//   newer export later only adds what's new.
// - Times are read in this device's time zone (Hevy exports local times).
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { track } from '../lib/saveStatus'
import { uuid } from './lib'

// Hevy name -> existing Liahona library name.
const ALIASES = {
  'Face Pull': 'Face Pull (Cable)',
  'Triceps Pushdown': 'Triceps Pushdown (Cable)',
  'Cable Fly Crossovers': 'Cable Fly',
  'Bulgarian Split Squat': 'Bulgarian Split Squat (Dumbbell)',
  'Back Extension (Hyperextension)': 'Back Extension',
  'Standing Calf Raise (Dumbbell)': 'Calf Raise (Dumbbell)',
  'Seated Incline Curl (Dumbbell)': 'Incline Curl (Dumbbell)',
  'Seated Shoulder Press (Machine)': 'Shoulder Press (Machine)',
}

// Known Hevy exercises not in the starter library: [muscle, equipment, type].
const KNOWN = {
  'Triceps Rope Pushdown': ['Triceps', 'Cable', 'weight_reps'],
  'Seated Lateral Raise (Dumbbell)': ['Shoulders', 'Dumbbell', 'weight_reps'],
  'Seated Cable Row - V Grip (Cable)': ['Back', 'Cable', 'weight_reps'],
  'Scapular Pull Ups': ['Back', 'Bodyweight', 'bodyweight_reps'],
  'Rear Delt Reverse Fly (Cable)': ['Shoulders', 'Cable', 'weight_reps'],
  'Hip Thrust (Machine)': ['Glutes', 'Machine', 'weight_reps'],
  'Low Cable Fly Crossovers': ['Chest', 'Cable', 'weight_reps'],
  'Jump Squat': ['Quads', 'Bodyweight', 'bodyweight_reps'],
  'Calf Press (Machine)': ['Calves', 'Machine', 'weight_reps'],
  'Seated Cable Row - Bar Grip': ['Back', 'Cable', 'weight_reps'],
  'Box Jump': ['Quads', 'Bodyweight', 'bodyweight_reps'],
  'Frog Jumps': ['Quads', 'Bodyweight', 'bodyweight_reps'],
  'Leg Press Horizontal (Machine)': ['Quads', 'Machine', 'weight_reps'],
  'Hip Adduction (Machine)': ['Other', 'Machine', 'weight_reps'],
  'Crunch (Machine)': ['Core', 'Machine', 'weight_reps'],
  'Seated Cable Row - Bar Wide Grip': ['Back', 'Cable', 'weight_reps'],
  'Reverse Curl (Cable)': ['Forearms', 'Cable', 'weight_reps'],
  'Lat Pulldown - Close Grip (Cable)': ['Back', 'Cable', 'weight_reps'],
  'Preacher Curl (Machine)': ['Biceps', 'Machine', 'weight_reps'],
  'Back Extension (Machine)': ['Back', 'Machine', 'weight_reps'],
  'Reverse Fly Single Arm (Cable)': ['Shoulders', 'Cable', 'weight_reps'],
  'Back Extension (Weighted Hyperextension)': ['Back', 'Bodyweight', 'weighted_bodyweight'],
  'Standing Calf Raise (Barbell)': ['Calves', 'Barbell', 'weight_reps'],
  'Seated Wrist Extension (Barbell)': ['Forearms', 'Barbell', 'weight_reps'],
  'Calf Extension (Machine)': ['Calves', 'Machine', 'weight_reps'],
  'Bent Over Row (Dumbbell)': ['Back', 'Dumbbell', 'weight_reps'],
  'Bicep Curl (Machine)': ['Biceps', 'Machine', 'weight_reps'],
  'Plate Front Raise': ['Shoulders', 'Other', 'weight_reps'],
  'Pull Up (Band)': ['Back', 'Other', 'assisted_bodyweight'],
  'Hammer Curl (Cable)': ['Biceps', 'Cable', 'weight_reps'],
}

const SET_TYPES = { normal: 'normal', warmup: 'warmup', dropset: 'drop', failure: 'failure' }
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }

export function parseCSV(text) {
  text = text.replace(/^﻿/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [head, ...body] = rows.filter((r) => r.length > 1)
  if (!head) return []
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

// "2 Jul 2026, 14:36" (local) -> Date
function hevyDate(s) {
  const m = s.trim().match(/^(\d+) (\w{3}) (\d{4}), (\d+):(\d+)$/)
  if (!m || MONTHS[m[2]] == null) throw new Error(`Unrecognised Hevy date: "${s}"`)
  return new Date(+m[3], MONTHS[m[2]], +m[1], +m[4], +m[5])
}

const localDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const numOrNull = (v) => (v === '' || v == null ? null : Number(v))

// Reads the file and works out what would be imported, without saving.
export async function planHevyImport(text) {
  const rows = parseCSV(text)
  if (!rows.length || !('exercise_title' in rows[0]) || !('start_time' in rows[0]))
    throw new Error("This doesn't look like a Hevy workout export (workout_data.csv).")

  const [library, existing] = await Promise.all([
    fetchAll(() => supabase.from('exercises').select('id,name')),
    fetchAll(() => supabase.from('workouts').select('started_at')),
  ])
  const byName = new Map(library.map((e) => [e.name, e.id]))
  const existingStarts = new Set(existing.map((w) => new Date(w.started_at).getTime()))

  const workouts = new Map()
  for (const r of rows) {
    const key = `${r.title}|${r.start_time}`
    if (!workouts.has(key)) {
      const start = hevyDate(r.start_time)
      workouts.set(key, {
        title: r.title,
        notes: r.description ?? '',
        start,
        end: r.end_time ? hevyDate(r.end_time) : start,
        exercises: new Map(),
      })
    }
    const w = workouts.get(key)
    const name = ALIASES[r.exercise_title] ?? r.exercise_title
    if (!w.exercises.has(name)) w.exercises.set(name, { notes: r.exercise_notes ?? '', sets: [] })
    w.exercises.get(name).sets.push(r)
  }

  const all = [...workouts.values()]
  const fresh = all.filter((w) => !existingStarts.has(w.start.getTime()))
  const names = new Set(fresh.flatMap((w) => [...w.exercises.keys()]))
  const newExercises = [...names]
    .filter((n) => !byName.has(n))
    .map((n) => {
      const [muscle_group, equipment, exercise_type] = KNOWN[n] ?? ['Other', 'Other', guessType(rows, n)]
      return { name: n, muscle_group, equipment, exercise_type, is_custom: true }
    })

  return {
    workouts: fresh,
    skipped: all.length - fresh.length,
    setCount: fresh.reduce((n, w) => n + [...w.exercises.values()].reduce((m, e) => m + e.sets.length, 0), 0),
    newExercises,
    mergedCount: [...names].filter((n) => byName.has(n)).length,
    byName,
    first: all.length ? new Date(Math.min(...all.map((w) => w.start))) : null,
    last: all.length ? new Date(Math.max(...all.map((w) => w.start))) : null,
  }
}

function guessType(rows, name) {
  const sets = rows.filter((r) => (ALIASES[r.exercise_title] ?? r.exercise_title) === name)
  if (sets.some((s) => s.distance_miles)) return 'distance_duration'
  if (sets.some((s) => s.duration_seconds) && !sets.some((s) => s.reps)) return 'duration'
  if (sets.some((s) => s.weight_lbs)) return 'weight_reps'
  return 'bodyweight_reps'
}

// Saves the plan. If anything fails part-way, the workouts added by this
// run are removed again so you never end up with half an import.
export async function runHevyImport(plan) {
  const byName = new Map(plan.byName)
  if (plan.newExercises.length) {
    const { data, error } = await track(supabase.from('exercises').insert(plan.newExercises).select('id,name'))
    if (error) throw new Error(`Couldn't add exercises — ${error.message}`)
    for (const e of data) byName.set(e.name, e.id)
  }

  const workoutRows = []
  const weRows = []
  const setRows = []
  for (const w of plan.workouts) {
    const workoutId = uuid()
    workoutRows.push({
      id: workoutId,
      workout_date: localDate(w.start),
      name: w.title,
      notes: w.notes,
      started_at: w.start.toISOString(),
      ended_at: w.end.toISOString(),
      source: 'hevy',
    })
    let position = 0
    for (const [name, ex] of w.exercises) {
      const weId = uuid()
      const exerciseId = byName.get(name)
      weRows.push({ id: weId, workout_id: workoutId, exercise_id: exerciseId, position: position++, notes: ex.notes })
      ex.sets
        .slice()
        .sort((a, b) => +a.set_index - +b.set_index)
        .forEach((s, i) =>
          setRows.push({
            workout_id: workoutId,
            workout_exercise_id: weId,
            exercise_id: exerciseId,
            set_order: i,
            set_type: SET_TYPES[s.set_type] ?? 'normal',
            weight: numOrNull(s.weight_lbs),
            weight_unit: 'lbs',
            reps: numOrNull(s.reps),
            duration_seconds: numOrNull(s.duration_seconds),
            distance: numOrNull(s.distance_miles),
            distance_unit: 'mi',
            rpe: numOrNull(s.rpe),
            completed: true,
            completed_at: w.end.toISOString(),
          }),
        )
    }
  }

  const insert = async (table, rows) => {
    for (let i = 0; i < rows.length; i += 400) {
      const { error } = await track(supabase.from(table).insert(rows.slice(i, i + 400)))
      if (error) throw new Error(`${table}: ${error.message}`)
    }
  }
  try {
    await insert('workouts', workoutRows)
    await insert('workout_exercises', weRows)
    await insert('workout_sets', setRows)
  } catch (e) {
    await supabase
      .from('workouts')
      .delete()
      .in(
        'id',
        workoutRows.map((w) => w.id),
      )
    throw new Error(`Import failed and was rolled back — ${e.message}`)
  }
  return { workouts: workoutRows.length, sets: setRows.length }
}
