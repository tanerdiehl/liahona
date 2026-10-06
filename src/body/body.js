// Body log helpers. Every entry is kept as logged (with its own units);
// charts convert to your current units and average within each day/week/month.
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { convertWeight } from '../workout/lib'
import { bucketKey, bucketLabel, bucketRange } from '../workout/stats'

export const MEASUREMENTS = [
  ['waist', 'Waist'],
  ['chest', 'Chest'],
  ['hips', 'Hips'],
  ['arms', 'Arms'],
  ['thighs', 'Thighs'],
  ['calves', 'Calves'],
  ['shoulders', 'Shoulders'],
  ['neck', 'Neck'],
]

export const fetchBodyLogs = () =>
  fetchAll(() => supabase.from('body_logs').select('*').order('log_date').order('created_at'))

export const toMeasure = (v, from, to) => (v == null || from === to ? v : from === 'in' ? v * 2.54 : v / 2.54)

// Value of one field per entry, in the requested unit.
export function series(logs, field, unit) {
  return logs
    .filter((l) => l[field] != null)
    .map((l) => ({
      date: l.log_date,
      value:
        field === 'bodyweight'
          ? convertWeight(Number(l.bodyweight), l.weight_unit, unit)
          : toMeasure(Number(l[field]), l.measure_unit, unit),
    }))
}

// Average per bucket from `from` to `to` (empty buckets have value 0 = no point).
export function bucketed(points, g, from, to) {
  if (!points.length) return []
  const keys = bucketRange(from ?? points[0].date, to, g)
  const sums = new Map()
  for (const p of points) {
    const k = bucketKey(p.date, g)
    const b = sums.get(k) ?? { sum: 0, n: 0 }
    b.sum += p.value
    b.n++
    sums.set(k, b)
  }
  return keys.map((k) => {
    const b = sums.get(k)
    return { key: k, label: bucketLabel(k, g), value: b ? b.sum / b.n : 0, n: b?.n ?? 0 }
  })
}

export const round1 = (v) => Math.round(v * 10) / 10
