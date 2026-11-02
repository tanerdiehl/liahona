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

// Finished workouts with their completed sets, in order. from / to are
// 'YYYY-MM-DD' (inclusive); leave either out for no limit.
export async function fetchWorkoutData({ from, to } = {}) {
  const [workouts, wes, sets, exercises] = await Promise.all([
    fetchAll(() => {
      let q = supabase.from('workouts').select('*').not('ended_at', 'is', null)
      if (from) q = q.gte('workout_date', from)
      if (to) q = q.lte('workout_date', to)
      return q.order('started_at').order('id')
    }),
    fetchAll(() => supabase.from('workout_exercises').select('*').order('id')),
    fetchAll(() => supabase.from('workout_sets').select('*').eq('completed', true).order('set_order').order('id')),
    fetchAll(() => supabase.from('exercises').select('*').order('id')),
  ])
  const exById = new Map(exercises.map((e) => [e.id, e]))
  const weById = new Map(wes.map((w) => [w.id, w]))
  const setsBy = new Map()
  for (const st of sets) {
    if (!setsBy.has(st.workout_id)) setsBy.set(st.workout_id, [])
    setsBy.get(st.workout_id).push(st)
  }
  return workouts.map((w) => {
    const mine = (setsBy.get(w.id) ?? []).sort(
      (a, b) =>
        (weById.get(a.workout_exercise_id)?.position ?? 0) - (weById.get(b.workout_exercise_id)?.position ?? 0) ||
        a.set_order - b.set_order,
    )
    // Group into exercises, in the order they were done.
    const exercisesDone = []
    for (const st of mine) {
      let entry = exercisesDone.find((x) => x.weId === st.workout_exercise_id)
      if (!entry) {
        entry = { weId: st.workout_exercise_id, ex: exById.get(st.exercise_id), notes: weById.get(st.workout_exercise_id)?.notes ?? '', sets: [] }
        exercisesDone.push(entry)
      }
      entry.sets.push(st)
    }
    return { workout: w, exercises: exercisesDone }
  })
}

const fmtSecs = (secs) => {
  if (secs == null) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const sec = secs % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}
const num = (v) => (v == null ? '' : String(Number(v)))
const TYPE_MARK = { warmup: 'W ', drop: 'D ', failure: 'F ' }

// One set as text, e.g. "135×8", "W 45×12", "+25×6", "12", "1:30", "2 mi in 18:00".
function setText(st, type) {
  const unit = st.weight_unit === 'kg' ? 'kg' : ''
  const w = st.weight != null ? num(st.weight) + unit : null
  let out
  switch (type) {
    case 'bodyweight_reps':
      out = num(st.reps)
      break
    case 'weighted_bodyweight':
      out = Number(st.weight) ? `+${w}×${num(st.reps)}` : num(st.reps)
      break
    case 'assisted_bodyweight':
      out = `−${w ?? 0}×${num(st.reps)}`
      break
    case 'duration':
      out = fmtSecs(st.duration_seconds)
      break
    case 'distance_duration':
      out = `${num(st.distance)} ${st.distance_unit}${st.duration_seconds ? ` in ${fmtSecs(st.duration_seconds)}` : ''}`
      break
    default:
      out = w != null ? `${w}×${num(st.reps)}` : num(st.reps)
  }
  return (TYPE_MARK[st.set_type] ?? '') + out
}

// Plain-text log of workouts — easy to read, paste into notes or a spreadsheet.
export function workoutDataText(data, { from, to } = {}) {
  const lines = [
    `Workouts${from || to ? ` ${from ?? 'start'} to ${to ?? todayISO()}` : ''} — ${data.length} workout${data.length === 1 ? '' : 's'}`,
    'Weights in lbs unless marked kg. Sets are weight×reps. W = warm-up, D = drop set, F = failure.',
  ]
  for (const { workout: w, exercises } of data) {
    const mins = Math.round((new Date(w.ended_at) - new Date(w.started_at)) / 60000)
    lines.push('', `${w.workout_date} · ${w.name || 'Workout'} · ${mins} min`)
    if (w.notes) lines.push(`Notes: ${w.notes}`)
    for (const e of exercises) {
      const type = e.ex?.exercise_type ?? 'weight_reps'
      lines.push(`${e.ex?.name ?? 'Exercise'}: ${e.sets.map((st) => setText(st, type)).join(', ')}${e.notes ? `  (${e.notes})` : ''}`)
    }
  }
  return lines.join('\n')
}

// Every completed set, one row each. The first columns match Hevy's export
// format; the rest keep exact times, units and exercise details.
export async function exportWorkoutsCSV(range = {}, data = null) {
  data ??= await fetchWorkoutData(range)
  const rows = []
  for (const { workout: w, exercises } of data) {
    const mine = exercises.flatMap((e) => e.sets.map((st) => ({ ...st, _ex: e.ex, _notes: e.notes })))
    const indexIn = new Map()
    for (const s of mine) {
      const ex = s._ex
      const we = { notes: s._notes }
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
  const span = range.from || range.to ? `-${range.from ?? 'start'}-to-${range.to ?? stamp()}` : `-${stamp()}`
  download(`liahona-workouts${span}.csv`, toCSV(rows, cols))
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
