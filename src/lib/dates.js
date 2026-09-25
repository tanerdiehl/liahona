// All dates are handled as local-time 'YYYY-MM-DD' strings so "today"
// always means your today, not UTC's.

export function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso, n) {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function todayISO() {
  return toISO(new Date())
}

export function dateRange(startISO, endISO) {
  const out = []
  for (let d = startISO; d <= endISO; d = addDays(d, 1)) out.push(d)
  return out
}

// Weeks start on Sunday (your planning day).
export function startOfWeek(iso) {
  return addDays(iso, -fromISO(iso).getDay())
}

export function startOfMonth(iso) {
  return iso.slice(0, 8) + '01'
}

export function weekRange(firstWeekStart, lastWeekStart) {
  const out = []
  for (let d = firstWeekStart; d <= lastWeekStart; d = addDays(d, 7)) out.push(d)
  return out
}

const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const longFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const longYearFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const shortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

export const weekdayShort = (iso) => weekdayFmt.format(fromISO(iso))
// Year is shown only for dates outside the current year.
export const formatLong = (iso) =>
  (iso.slice(0, 4) === todayISO().slice(0, 4) ? longFmt : longYearFmt).format(fromISO(iso))
export const formatShort = (iso) => shortFmt.format(fromISO(iso))
