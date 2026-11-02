import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { track } from '../lib/saveStatus'
import { addDays, formatShort, fromISO } from '../lib/dates'

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

// ---------- repeating plans ----------
export const WEEKDAYS = [1, 2, 3, 4, 5]
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export const occursOn = (s, d) =>
  s.start_date <= d && (!s.end_date || s.end_date >= d) && s.days.includes(fromISO(d).getDay())

// 'daily' | 'weekdays' | 'weekly' from a list of weekdays.
export function repeatKind(days) {
  const set = [...days].sort().join()
  if (set === ALL_DAYS.join()) return 'daily'
  if (set === WEEKDAYS.join()) return 'weekdays'
  return 'weekly'
}

export function describeRepeat(s) {
  const kind = repeatKind(s.days)
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const what =
    kind === 'daily'
      ? 'Every day'
      : kind === 'weekdays'
        ? 'Weekdays'
        : `Every ${[...s.days].sort().map((d) => names[d]).join(', ')}`
  return s.end_date ? `${what} until ${formatShort(s.end_date)}` : what
}

const EVENT_COLS = ['id', 'date', 'start_time', 'end_time', 'title', 'category', 'location', 'notes', 'backup', 'status', 'task_id', 'series_id']
const SERIES_COLS = ['title', 'category', 'location', 'notes', 'backup', 'start_time', 'end_time']
const pick = (row, cols) => Object.fromEntries(cols.filter((c) => row[c] !== undefined).map((c) => [c, row[c]]))
const uuid = () => crypto.randomUUID()

// A day of a repeating plan that has no saved row of its own yet.
const virtualFor = (s, date) => ({
  id: `v:${s.id}:${date}`,
  virtual: true,
  series_id: s.id,
  date,
  ...pick(s, SERIES_COLS),
  status: 'planned',
  task_id: null,
})

// Everything for one day, plus which days of that week have plans.
export function usePlan(date, weekStart) {
  const [rows, setRows] = useState(null) // saved plan_events for this day
  const [series, setSeries] = useState([]) // repeating plans active this week
  const [weekRows, setWeekRows] = useState([])
  const [day, setDay] = useState({ priorities: '', review: '' })
  const [error, setError] = useState('')
  const weekEnd = addDays(weekStart, 6)

  const load = useCallback(async () => {
    const [ev, dp, wk, sr] = await Promise.all([
      supabase.from('plan_events').select('*').eq('date', date).order('start_time'),
      supabase.from('day_plans').select('*').eq('date', date).maybeSingle(),
      supabase.from('plan_events').select('id,date,series_id,status').gte('date', weekStart).lte('date', weekEnd),
      supabase.from('plan_series').select('*').lte('start_date', weekEnd).or(`end_date.is.null,end_date.gte.${weekStart}`),
    ])
    const err = ev.error || dp.error || wk.error || sr.error
    if (err) return setError(err.message)
    setError('')
    setRows(ev.data)
    setWeekRows(wk.data)
    setSeries(sr.data)
    setDay(dp.data ?? { priorities: '', review: '' })
  }, [date, weekStart, weekEnd])

  useEffect(() => {
    setRows(null)
    load()
  }, [load])

  const seriesById = Object.fromEntries(series.map((s) => [s.id, s]))

  const events = rows
    ? [
        ...rows.filter((r) => r.status !== 'skipped'),
        ...series
          .filter((s) => occursOn(s, date) && !rows.some((r) => r.series_id === s.id))
          .map((s) => virtualFor(s, date)),
      ].sort(byStart)
    : null

  const weekCounts = {}
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i)
    const mine = weekRows.filter((r) => r.date === d)
    weekCounts[d] =
      mine.filter((r) => r.status !== 'skipped').length +
      series.filter((s) => occursOn(s, d) && !mine.some((r) => r.series_id === s.id)).length
  }

  function fail(e) {
    setError(`${e.what ?? 'Not saved'} — ${e.message}`)
    load()
  }
  async function run(query, what = 'Not saved') {
    const { error } = await track(query)
    if (error) throw Object.assign(new Error(error.message), { what })
  }

  // Save one day's plan. A repeating plan's day becomes its own row.
  async function save(event) {
    const row = pick({ ...event, date: event.date ?? date, id: event.virtual ? uuid() : event.id }, EVENT_COLS)
    row.updated_at = new Date().toISOString()
    setRows((prev) => [...(prev ?? []).filter((r) => r.id !== row.id), row].filter((r) => r.date === date).sort(byStart))
    setWeekRows((prev) => [...prev.filter((r) => r.id !== row.id), row])
    try {
      await run(supabase.from('plan_events').upsert(row))
    } catch (e) {
      fail(e)
    }
  }

  // scope: 'one' (just this day) or 'following' (this day and every one after).
  async function remove(event, scope = 'one') {
    try {
      if (!event.series_id) {
        setRows((prev) => prev.filter((e) => e.id !== event.id))
        setWeekRows((prev) => prev.filter((e) => e.id !== event.id))
        await run(supabase.from('plan_events').delete().eq('id', event.id), 'Not deleted')
        return
      }
      if (scope === 'one') return save({ ...event, status: 'skipped' })
      const s = seriesById[event.series_id]
      await run(supabase.from('plan_events').delete().eq('series_id', event.series_id).gte('date', event.date), 'Not deleted')
      if (!s || event.date <= s.start_date) await run(supabase.from('plan_series').delete().eq('id', event.series_id), 'Not deleted')
      else await run(supabase.from('plan_series').update({ end_date: addDays(event.date, -1) }).eq('id', s.id), 'Not deleted')
      load()
    } catch (e) {
      fail(e)
    }
  }

  // Start repeating from this event's day. repeat: { days, end_date }
  async function makeRepeating(event, repeat) {
    try {
      const id = uuid()
      await run(
        supabase.from('plan_series').insert({
          id,
          ...pick(event, SERIES_COLS),
          days: repeat.days,
          end_date: repeat.end_date || null,
          start_date: event.date,
        }),
      )
      // An existing one-off becomes the first day of the series (keeps its ✓).
      if (!event.isNew && !event.virtual)
        await run(supabase.from('plan_events').update({ ...pick(event, SERIES_COLS), series_id: id, date: event.date }).eq('id', event.id))
      load()
    } catch (e) {
      fail(e)
    }
  }

  // Change a repeating plan from this day on. repeat = null stops it
  // repeating (this day stays as a one-off; earlier days are untouched).
  async function saveFollowing(event, repeat) {
    const s = seriesById[event.series_id]
    if (!s) return save(event)
    try {
      const fields = pick(event, SERIES_COLS)
      if (!repeat) {
        if (event.date <= s.start_date) await run(supabase.from('plan_series').delete().eq('id', s.id))
        else await run(supabase.from('plan_series').update({ end_date: addDays(event.date, -1) }).eq('id', s.id))
        await run(supabase.from('plan_events').delete().eq('series_id', s.id).gt('date', event.date))
        await run(
          supabase
            .from('plan_events')
            .upsert(pick({ ...event, id: event.virtual ? uuid() : event.id, series_id: null, status: event.status ?? 'planned' }, EVENT_COLS)),
        )
      } else if (event.date <= s.start_date) {
        await run(supabase.from('plan_series').update({ ...fields, days: repeat.days, end_date: repeat.end_date || null }).eq('id', s.id))
        if (!event.virtual) await run(supabase.from('plan_events').update(fields).eq('id', event.id))
      } else {
        const id = uuid()
        await run(supabase.from('plan_series').update({ end_date: addDays(event.date, -1) }).eq('id', s.id))
        await run(
          supabase.from('plan_series').insert({
            id,
            ...fields,
            days: repeat.days,
            end_date: repeat.end_date || null,
            start_date: event.date,
          }),
        )
        await run(supabase.from('plan_events').update({ series_id: id }).eq('series_id', s.id).gte('date', event.date))
        if (!event.virtual) await run(supabase.from('plan_events').update(fields).eq('id', event.id))
      }
      load()
    } catch (e) {
      fail(e)
    }
  }

  async function saveDay(fields) {
    setDay((d) => ({ ...d, ...fields }))
    const { error } = await track(
      supabase.from('day_plans').upsert({ date, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' }),
    )
    if (error) setError(`Not saved — ${error.message}`)
  }

  return { events, day, weekCounts, seriesById, error, save, remove, makeRepeating, saveFollowing, saveDay, reload: load }
}
