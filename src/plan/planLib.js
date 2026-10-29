import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { track } from '../lib/saveStatus'
import { addDays } from '../lib/dates'

// Day planner, modeled on the Preach My Gospel app: each day is a column of
// time blocks you plan ahead, then mark done (✓) or didn't happen (✕).

export const CATEGORIES = {
  spiritual: { label: 'Spiritual', color: '#7d6bc2' },
  work: { label: 'School / work', color: '#4f86c6' },
  workout: { label: 'Workout', color: '#d0794a' },
  music: { label: 'Music', color: '#c25b8f' },
  people: { label: 'People / service', color: '#3f9a6e' },
  personal: { label: 'Personal', color: '#b39a3a' },
  other: { label: 'Other', color: '#7a7c86' },
}

// Times are stored as Postgres `time` ('08:30:00'); the UI works in minutes.
export const toMin = (t) => {
  const [h, m] = String(t).split(':').map(Number)
  return h * 60 + (m || 0)
}
export const fromMin = (min) => {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const clockFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
export const formatTime = (t) => {
  const m = toMin(t)
  return clockFmt.format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60)).replace(':00', '')
}
export const nowMin = () => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

const byStart = (a, b) => toMin(a.start_time) - toMin(b.start_time) || toMin(a.end_time) - toMin(b.end_time)

// Side-by-side columns for blocks that overlap in time.
export function layoutEvents(events) {
  const sorted = [...events].sort(byStart)
  const out = []
  let group = []
  let groupEnd = -1
  const flush = () => {
    const cols = []
    for (const e of group) {
      let c = cols.findIndex((end) => end <= toMin(e.start_time))
      if (c < 0) c = cols.length
      cols[c] = toMin(e.end_time)
      out.push({ e, col: c })
    }
    for (const o of out.slice(-group.length)) o.cols = cols.length
    group = []
  }
  for (const e of sorted) {
    if (group.length && toMin(e.start_time) >= groupEnd) flush()
    group.push(e)
    groupEnd = Math.max(groupEnd, toMin(e.end_time))
  }
  if (group.length) flush()
  return out
}

// Everything for one day, plus which days of that week have plans.
export function usePlan(date, weekStart) {
  const [events, setEvents] = useState(null)
  const [day, setDay] = useState({ priorities: '', review: '' })
  const [weekCounts, setWeekCounts] = useState({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [ev, dp, wk] = await Promise.all([
      supabase.from('plan_events').select('*').eq('date', date).order('start_time'),
      supabase.from('day_plans').select('*').eq('date', date).maybeSingle(),
      supabase.from('plan_events').select('date').gte('date', weekStart).lte('date', addDays(weekStart, 6)),
    ])
    const err = ev.error || dp.error || wk.error
    if (err) return setError(err.message)
    setError('')
    setEvents(ev.data)
    setDay(dp.data ?? { priorities: '', review: '' })
    const counts = {}
    for (const r of wk.data) counts[r.date] = (counts[r.date] ?? 0) + 1
    setWeekCounts(counts)
  }, [date, weekStart])

  useEffect(() => {
    setEvents(null)
    load()
  }, [load])

  const bump = (d, n) => setWeekCounts((c) => ({ ...c, [d]: Math.max(0, (c[d] ?? 0) + n) }))

  async function save(event) {
    const row = { ...event, date: event.date ?? date, updated_at: new Date().toISOString() }
    const isNew = !events?.some((e) => e.id === row.id)
    setEvents((prev) =>
      (isNew ? [...(prev ?? []), row] : prev.map((e) => (e.id === row.id ? { ...e, ...row } : e)))
        .filter((e) => e.date === date)
        .sort(byStart),
    )
    if (isNew) bump(row.date, 1)
    const { error } = await track(supabase.from('plan_events').upsert(row))
    if (error) {
      setError(`Not saved — ${error.message}`)
      load()
    }
  }

  async function remove(event) {
    setEvents((prev) => prev.filter((e) => e.id !== event.id))
    bump(event.date, -1)
    const { error } = await track(supabase.from('plan_events').delete().eq('id', event.id))
    if (error) {
      setError(`Not deleted — ${error.message}`)
      load()
    }
  }

  async function saveDay(fields) {
    setDay((d) => ({ ...d, ...fields }))
    const { error } = await track(
      supabase.from('day_plans').upsert({ date, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' }),
    )
    if (error) setError(`Not saved — ${error.message}`)
  }

  return { events, day, weekCounts, error, save, remove, saveDay, reload: load }
}
