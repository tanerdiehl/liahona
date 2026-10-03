import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { SEED_EXERCISES } from './seedExercises'
import { getSettings } from '../lib/settings'

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'Full body',
  'Cardio',
  'Other',
]

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'EZ Bar', 'Kettlebell', 'Bodyweight', 'None', 'Other']

export const EXERCISE_TYPES = {
  weight_reps: { label: 'Weight × reps', fields: ['weight', 'reps'] },
  bodyweight_reps: { label: 'Bodyweight reps', fields: ['reps'] },
  weighted_bodyweight: { label: 'Weighted bodyweight', fields: ['weight', 'reps'], weightLabel: '+' },
  assisted_bodyweight: { label: 'Assisted bodyweight', fields: ['weight', 'reps'], weightLabel: '−' },
  duration: { label: 'Duration', fields: ['duration'] },
  distance_duration: { label: 'Distance + time', fields: ['distance', 'duration'] },
}

export const SET_TYPES = {
  normal: { short: null, label: 'Normal' },
  warmup: { short: 'W', label: 'Warm-up' },
  drop: { short: 'D', label: 'Drop set' },
  failure: { short: 'F', label: 'Failure' },
}
export const SET_TYPE_CYCLE = ['normal', 'warmup', 'drop', 'failure']

// ---------- settings + library seeding ----------

export const loadSettings = getSettings

let seeding = null
export function ensureExercisesSeeded(settings) {
  if (settings.exercises_seeded) return Promise.resolve()
  seeding ??= (async () => {
    const rows = SEED_EXERCISES.map(([name, muscle_group, equipment, exercise_type]) => ({
      name,
      muscle_group,
      equipment,
      exercise_type,
      is_custom: false,
    }))
    const { error } = await supabase.from('exercises').upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true })
    if (error) throw error
    await supabase.from('user_settings').update({ exercises_seeded: true }).eq('user_id', settings.user_id)
  })().catch((e) => {
    seeding = null // allow a retry next time
    throw e
  })
  return seeding
}

export async function fetchExercises() {
  return fetchAll(() => supabase.from('exercises').select('*').eq('archived', false).order('name'))
}

export async function fetchActiveWorkout() {
  const { data, error } = await supabase
    .from('workouts')
    .select('id,name,started_at')
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data[0] ?? null
}

// Sets from the most recent *other* workout that included this exercise —
// used to ghost-fill numbers when you add it again.
// before: only look at sets logged before this time (used when editing an
// old workout, so "previous" means the session before it).
export async function fetchPreviousSets(exerciseId, excludeWorkoutId, before = null) {
  let q = supabase
    .from('workout_sets')
    .select('*')
    .eq('exercise_id', exerciseId)
    .eq('completed', true)
    .neq('workout_id', excludeWorkoutId)
  if (before) q = q.lt('completed_at', before)
  const { data, error } = await q.order('completed_at', { ascending: false }).limit(40)
  if (error) throw error
  if (!data.length) return []
  const lastWorkout = data[0].workout_id
  return data.filter((s) => s.workout_id === lastWorkout).sort((a, b) => a.set_order - b.set_order)
}

// ---------- units & math ----------

const LBS_PER_KG = 2.20462

export function convertWeight(value, from, to) {
  if (value == null || from === to) return value
  return from === 'kg' ? value * LBS_PER_KG : value / LBS_PER_KG
}

export const roundWeight = (w) => Math.round(w * 4) / 4

// Epley estimated one-rep max.
export const epley = (weight, reps) => (reps > 0 && weight > 0 ? weight * (1 + reps / 30) : 0)

// Volume counts external load only: weight × reps (added weight for weighted
// bodyweight). Assisted, bodyweight, and cardio sets have no load volume.
export function setVolume(set, exerciseType, unit) {
  if (!set.completed || !set.reps || set.weight == null) return 0
  if (exerciseType !== 'weight_reps' && exerciseType !== 'weighted_bodyweight') return 0
  return convertWeight(Number(set.weight), set.weight_unit, unit) * set.reps
}

export function formatDuration(totalSeconds) {
  if (totalSeconds == null || isNaN(totalSeconds)) return ''
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

// "1:30" -> 90, "90" -> 90, "1:02:00" -> 3720
export function parseDuration(text) {
  const t = String(text).trim()
  if (!t) return null
  const parts = t.split(':').map(Number)
  if (parts.some((n) => isNaN(n) || n < 0)) return null
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

export function workoutSeconds(w, now = Date.now()) {
  const end = w.ended_at ? new Date(w.ended_at).getTime() : now
  return (end - new Date(w.started_at).getTime()) / 1000
}

export function formatVolume(v, unit) {
  return `${Math.round(v).toLocaleString()} ${unit}`
}

export function defaultWorkoutName(date = new Date()) {
  const h = date.getHours()
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night'
  return `${part} workout`
}

export const uuid = () => crypto.randomUUID()
