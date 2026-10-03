import { addDays, dateRange, startOfMonth, startOfWeek, todayISO, weekRange } from './dates'

// Scoring rules (see README):
// - A habit is tracked from its start_date (or its earliest log, if earlier),
//   but never from before your tracking start date.
// - Every tracked day (or week, for weekly habits) counts. Blank and ✕ are misses.
// - Today / this week only counts once you've marked it, so an unfinished
//   day never drags your numbers down.
// - A streak is consecutive ✓ units ending today (or yesterday, if today is still blank).

export function habitStats(habit, logs, today = todayISO(), trackingStart = null) {
  const weekly = habit.frequency === 'weekly'
  const current = weekly ? startOfWeek(today) : today

  let start = habit.start_date
  for (const d of logs.keys()) if (d < start) start = d
  // Nothing before the day you started using the app counts.
  if (trackingStart && start < trackingStart) start = trackingStart
  if (weekly) start = startOfWeek(start)
  if (start > current) start = current

  const units = weekly ? weekRange(start, current) : dateRange(start, current)
  const counted = units.filter((u) => u !== current || logs.has(u))
  const isDone = (u) => logs.get(u) === 'done'

  const rate = (from) => {
    const c = counted.filter((u) => u >= from)
    if (c.length === 0) return null
    const done = c.filter(isDone).length
    return { pct: done / c.length, done, total: c.length }
  }

  const windows = weekly
    ? [
        ['Last 4 wks', rate(addDays(current, -21))],
        ['Last 12 wks', rate(addDays(current, -77))],
        ['All time', rate(start)],
      ]
    : [
        ['This week', rate(startOfWeek(today))],
        ['This month', rate(startOfMonth(today))],
        ['All time', rate(start)],
      ]

  let currentStreak = 0
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i]
    if (u === current && !logs.has(u)) continue
    if (isDone(u)) currentStreak++
    else break
  }

  let longest = 0
  let run = 0
  for (const u of units) {
    run = isDone(u) ? run + 1 : 0
    if (run > longest) longest = run
  }

  // Weekly completion rate for the last 12 weeks (daily habits only).
  const thisWeek = startOfWeek(today)
  const trend = weekly
    ? null
    : weekRange(
        addDays(thisWeek, -77) > startOfWeek(start) ? addDays(thisWeek, -77) : startOfWeek(start),
        thisWeek,
      ).map((w) => {
        const days = dateRange(w, addDays(w, 6)).filter(
          (d) => d >= start && d <= today && (d !== today || logs.has(d)),
        )
        const done = days.filter(isDone).length
        return { week: w, done, total: days.length, pct: days.length ? done / days.length : null }
      })

  // Completion rate per calendar month ('YYYY-MM') and per year ('YYYY'),
  // for month-over-month and year-over-year comparison. Weekly habits are
  // bucketed by the month their week starts in.
  const bucket = (len) => {
    const out = new Map()
    for (const u of counted) {
      const k = u.slice(0, len)
      const b = out.get(k) ?? { done: 0, total: 0 }
      b.total++
      if (isDone(u)) b.done++
      out.set(k, b)
    }
    for (const b of out.values()) b.pct = b.done / b.total
    return out
  }

  return { weekly, start, windows, currentStreak, longest, trend, monthly: bucket(7), yearly: bucket(4) }
}

export const pctLabel = (r) => (r == null ? '—' : `${Math.round(r.pct * 100)}%`)
