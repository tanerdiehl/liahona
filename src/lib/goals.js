import { supabase } from './supabase'

export const TIERS = [
  { id: 'medium', label: 'Medium-term', hint: 'Within 1–2 years' },
  { id: 'long', label: 'Long-term', hint: '5+ years & life goals' },
]

export const PROGRESS_TYPES = [
  { id: 'checklist', label: 'Checklist' },
  { id: 'percent', label: 'Percentage' },
  { id: 'status', label: 'Status' },
]

// Goals with their checklist items, in display order.
export async function fetchGoals() {
  const { data, error } = await supabase
    .from('goals')
    .select('*, goal_items(*)')
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  for (const g of data) g.goal_items.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
  return data
}

// pct is 0..1, or null for freeform-status goals.
export function goalProgress(goal) {
  if (goal.completed_at) return { pct: 1, label: 'Achieved' }
  if (goal.progress_type === 'percent') return { pct: goal.percent / 100, label: `${goal.percent}%` }
  if (goal.progress_type === 'status') return { pct: null, label: goal.status.trim() || 'No status yet' }
  const items = goal.goal_items ?? []
  const done = items.filter((i) => i.done).length
  return {
    pct: items.length ? done / items.length : 0,
    label: items.length ? `${done} of ${items.length} steps` : 'No steps yet',
  }
}
