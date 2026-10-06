// One-tap exports of your raw data as CSV (opens in Excel / Google Sheets)
// or JSON. Every row is exported exactly as stored — nothing summarised.
import { supabase } from './supabase'
import { fetchAll } from './habits'
import { todayISO } from './dates'

function csvCell(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows, columns) {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n')
}

export function download(name, text, type = 'text/csv') {
  const blob = new Blob([type === 'text/csv' ? '﻿' + text : text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const stamp = () => todayISO()
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Hevy's date style, so the file also works in apps that read Hevy exports.
const hevyTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const LBS = 2.20462
const SET_TYPE_HEVY = { normal: 'normal', warmup: 'warmup', drop: 'dropset', failure: 'failure' }

// Every completed set, one row each. The first columns match Hevy's export
// format; the rest keep exact times, units and exercise details.
export async function exportWorkoutsCSV() {
  const [workouts, wes, sets, exercises] = await Promise.all([
    fetchAll(() => supabase.from('workouts').select('*').not('ended_at', 'is', null).order('started_at')),
    fetchAll(() => supabase.from('workout_exercises').select('*').order('id')),
    fetchAll(() => supabase.from('workout_sets').select('*').eq('completed', true).order('set_order').order('id')),
    fetchAll(() => supabase.from('exercises').select('*').order('id')),
  ])
  const exById = new Map(exercises.map((e) => [e.id, e]))
  const weById = new Map(wes.map((w) => [w.id, w]))
  const rows = []
  for (const w of workouts) {
    const mine = sets
      .filter((s) => s.workout_id === w.id)
      .sort((a, b) => (weById.get(a.workout_exercise_id)?.position ?? 0) - (weById.get(b.workout_exercise_id)?.position ?? 0))
    const indexIn = new Map()
    for (const s of mine) {
      const ex = exById.get(s.exercise_id)
      const we = weById.get(s.workout_exercise_id)
      const i = indexIn.get(s.workout_exercise_id) ?? 0
      indexIn.set(s.workout_exercise_id, i + 1)
      const weight = s.weight == null ? null : Number(s.weight)
      const miles =
        s.distance == null ? null : s.distance_unit === 'km' ? s.distance * 0.621371 : s.distance_unit === 'm' ? s.distance / 1609.344 : s.distance
      rows.push({
        title: w.name,
        start_time: hevyTime(w.started_at),
        end_time: hevyTime(w.ended_at),
        description: w.notes,
        exercise_title: ex?.name,
        superset_id: '',
        exercise_notes: we?.notes ?? '',
        set_index: i,
        set_type: SET_TYPE_HEVY[s.set_type] ?? s.set_type,
        weight_lbs: weight == null ? '' : Math.round((s.weight_unit === 'kg' ? weight * LBS : weight) * 100) / 100,
        reps: s.reps,
        distance_miles: miles == null ? '' : Math.round(miles * 1000) / 1000,
        duration_seconds: s.duration_seconds,
        rpe: s.rpe,
        workout_date: w.workout_date,
        started_at: w.started_at,
        ended_at: w.ended_at,
        weight,
        weight_unit: s.weight_unit,
        distance: s.distance,
        distance_unit: s.distance_unit,
        muscle_group: ex?.muscle_group,
        equipment: ex?.equipment,
        exercise_type: ex?.exercise_type,
        set_notes: s.notes,
        source: w.source ?? 'liahona',
      })
    }
  }
  const cols = [
    'title', 'start_time', 'end_time', 'description', 'exercise_title', 'superset_id', 'exercise_notes', 'set_index',
    'set_type', 'weight_lbs', 'reps', 'distance_miles', 'duration_seconds', 'rpe', 'workout_date', 'started_at',
    'ended_at', 'weight', 'weight_unit', 'distance', 'distance_unit', 'muscle_group', 'equipment', 'exercise_type',
    'set_notes', 'source',
  ]
  download(`liahona-workouts-${stamp()}.csv`, toCSV(rows, cols))
  return rows.length
}

export const BODY_COLUMNS = [
  'log_date', 'bodyweight', 'weight_unit', 'chest', 'waist', 'hips', 'arms', 'thighs', 'calves', 'shoulders', 'neck',
  'measure_unit', 'notes',
]

export async function exportBodyCSV() {
  const rows = await fetchAll(() => supabase.from('body_logs').select('*').order('log_date').order('id'))
  download(`liahona-body-${stamp()}.csv`, toCSV(rows, BODY_COLUMNS))
  return rows.length
}

export async function exportHabitsCSV() {
  const [habits, logs] = await Promise.all([
    fetchAll(() => supabase.from('habits').select('id,name,frequency').order('id')),
    fetchAll(() => supabase.from('habit_logs').select('habit_id,date,status').order('date').order('habit_id')),
  ])
  const names = new Map(habits.map((h) => [h.id, h]))
  const rows = logs.map((l) => ({
    date: l.date,
    habit: names.get(l.habit_id)?.name,
    frequency: names.get(l.habit_id)?.frequency,
    status: l.status,
  }))
  download(`liahona-habits-${stamp()}.csv`, toCSV(rows, ['date', 'habit', 'frequency', 'status']))
  return rows.length
}

export async function exportSimpleCSV(table, columns, order) {
  const rows = await fetchAll(() => supabase.from(table).select(columns.join(',')).order(order).order('id'))
  download(`liahona-${table.replace('_entries', '').replace('_', '-')}-${stamp()}.csv`, toCSV(rows, columns))
  return rows.length
}
