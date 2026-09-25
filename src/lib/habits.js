import { supabase } from './supabase'

export const PALETTE = [
  { name: 'Indigo', value: '#7F77DD' },
  { name: 'Teal', value: '#1D9E75' },
  { name: 'Amber', value: '#BA7517' },
  { name: 'Blue', value: '#378ADD' },
  { name: 'Navy', value: '#3B4A6B' },
  { name: 'Rose', value: '#C4607A' },
  { name: 'Sage', value: '#6E8B6B' },
  { name: 'Slate', value: '#6B7280' },
]

export const DEFAULT_HABITS = [
  {
    name: 'Discipleship',
    color: '#7F77DD',
    why: 'Draw closer to Christ, live my covenants.',
    system: 'Pray morning + night, scripture 30+ min, temple weekly, tithing/fast offerings, ministering biweekly.',
    minimum: 'Pray once, read one verse, go to church.',
    stretch: 'Frequent revelation, regular temple attendance, teaching others.',
  },
  {
    name: 'Physical strength',
    color: '#1D9E75',
    why: "Take care of the body I've been given.",
    system: '4-day lifting split.',
    minimum: 'Show up, eat three meals.',
    stretch: 'Train to failure, stay hydrated.',
  },
  {
    name: 'Guitar',
    color: '#BA7517',
    why: "Grow creatively, build a skill I'm passionate about.",
    system: '15+ min/day, Justin Guitar Grade 1.',
    minimum: 'Pick up the guitar.',
    stretch: 'Barre chords, finish Grade 1, three full songs.',
  },
  {
    name: 'Weekly planning',
    color: '#378ADD',
    frequency: 'weekly',
    why: 'I perform better when I plan.',
    system: 'Daily list, Sunday planning session.',
    minimum: 'Open it once/week.',
    stretch: 'Master calendar, no procrastination.',
  },
  {
    name: 'Sleep',
    color: '#3B4A6B',
    why: 'My body is a temple; I need real rest to do anything else.',
    system: 'In bed by 11pm.',
    minimum: 'In bed by 11, alarm at 7.',
    stretch: 'Asleep by 10:30, awake 6:30, 8–9 hrs.',
  },
]

// Supabase caps each response at 1000 rows; page through for full history.
export async function fetchAll(buildQuery, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

export async function fetchHabits() {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// Seed the starting habits exactly once per account. The flag lives on the
// user's auth metadata so deleting every habit later won't bring them back.
let seeding = null
export function seedIfNeeded(user, habits) {
  if (habits.length > 0 || user.user_metadata?.seeded) return Promise.resolve(false)
  if (!seeding) {
    seeding = (async () => {
      const rows = DEFAULT_HABITS.map((h, i) => ({ ...h, sort_order: i }))
      const { error } = await supabase.from('habits').insert(rows)
      if (error) throw error
      await supabase.auth.updateUser({ data: { seeded: true } })
      return true
    })()
  }
  return seeding
}
