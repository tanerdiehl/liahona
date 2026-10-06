import { supabase } from './supabase'
import { fetchAll } from './habits'
import { getSettings } from './settings'
import { convertWeight, epley } from '../workout/lib'

export const TIERS = [
  { id: 'medium', label: 'Medium-term', hint: 'Within 1–2 years' },
  { id: 'long', label: 'Long-term', hint: '5+ years & life goals' },
]

export const PROGRESS_TYPES = [
  { id: 'checklist', label: 'Checklist' },
  { id: 'percent', label: 'Percentage' },
  { id: 'status', label: 'Status' },
  { id: 'metric', label: 'Auto' },
]

// What an "Auto" goal tracks from your data.
export const METRICS = [
  { id: 'e1rm', label: 'Estimated 1RM', needsExercise: true },
  { id: 'weight', label: 'Heaviest weight lifted', needsExercise: true },
  { id: 'bodyweight', label: 'Bodyweight', needsExercise: false },
]

// Goals with their checklist items, in display order. "Auto" goals come
// back with _current (today's number) and _unit filled in.
export async function fetchGoals() {
  const { data, error } = await supabase
    .from('goals')
    .select('*, goal_items(*)')
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  for (const g of data) g.goal_items.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
  await attachMetrics(data)
  return data
}

// Fills in the live value for each "Auto" goal from your logged data:
// best estimated 1RM / heaviest weight on an exercise (all time), or your
// latest bodyweight. Units follow your weight setting.
export async function attachMetrics(goals) {
  const metric = goals.filter((g) => g.progress_type === 'metric' && g.metric_kind)
  if (!metric.length) return goals
  const { weight_unit: unit } = await getSettings().catch(() => ({ weight_unit: 'lbs' }))
  const exIds = [...new Set(metric.map((g) => g.metric_exercise_id).filter(Boolean))]
  const [sets, body] = await Promise.all([
    exIds.length
      ? fetchAll(() =>
          supabase
            .from('workout_sets')
            .select('exercise_id,weight,weight_unit,reps,set_type')
            .in('exercise_id', exIds)
            .eq('completed', true)
            .order('id'),
        ).catch(() => [])
      : [],
    metric.some((g) => g.metric_kind === 'bodyweight')
      ? supabase
          .from('body_logs')
          .select('bodyweight,weight_unit,log_date')
          .not('bodyweight', 'is', null)
          .order('log_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data }) => data ?? [])
      : [],
  ])
  for (const g of metric) {
    g._unit = unit
    if (g.metric_kind === 'bodyweight') {
      const b = body[0]
      g._current = b ? convertWeight(Number(b.bodyweight), b.weight_unit, unit) : undefined
      continue
    }
    const mine = sets.filter((s) => s.exercise_id === g.metric_exercise_id && s.set_type !== 'warmup' && s.weight != null)
    const values = mine.map((s) => {
      const w = convertWeight(Number(s.weight), s.weight_unit, unit)
      return g.metric_kind === 'e1rm' ? epley(w, s.reps ?? 0) : w
    })
    g._current = values.length ? Math.max(...values) : undefined
  }
  return goals
}

const round1 = (v) => Math.round(v * 10) / 10

// pct is 0..1, or null for freeform-status goals.
export function goalProgress(goal) {
  if (goal.completed_at) return { pct: 1, label: 'Achieved' }
  if (goal.progress_type === 'metric') {
    const { metric_start: start, metric_target: target, _current: cur, _unit: unit = '' } = goal
    if (target == null) return { pct: 0, label: 'Set a target' }
    if (cur == null) return { pct: 0, label: `No data yet · target ${round1(target)} ${unit}` }
    const from = start ?? 0
    const span = Number(target) - Number(from)
    const pct = span === 0 ? 1 : Math.max(0, Math.min(1, (cur - from) / span))
    return { pct, label: `${round1(cur)} / ${round1(target)} ${unit}`, reached: pct >= 1 }
  }
  if (goal.progress_type === 'percent') return { pct: goal.percent / 100, label: `${goal.percent}%` }
  if (goal.progress_type === 'status') return { pct: null, label: goal.status.trim() || 'No status yet' }
  const items = goal.goal_items ?? []
  const done = items.filter((i) => i.done).length
  return {
    pct: items.length ? done / items.length : 0,
    label: items.length ? `${done} of ${items.length} steps` : 'No steps yet',
  }
}
